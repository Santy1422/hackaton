"""Suite de auth: hashing, JWT, roles, dependencies y endpoints HTTP.

  - Unidad (sin DB): funciones puras de password/JWT/roles.
  - Integración (DB + TestClient): /api/auth/login, /me, /roles y guards por rol.

Correr:  .venv/bin/pytest tests/test_auth.py -v
"""

from __future__ import annotations

from datetime import timedelta

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from api.auth import (
    JWT_ALGORITHM,
    JWT_SECRET,
    ROLES,
    create_access_token,
    get_current_user,
    hash_password,
    public_user,
    require_roles,
    verify_password,
)

FAKE_USER = {"id": 42, "email": "x@altis.com", "role": "cfo", "opco": None}

# Lista canónica de roles esperados por el producto.
EXPECTED_ROLES = {"pe_board", "cfo", "opco_md", "project_lead"}
SCOPED_ROLES = {"opco_md", "project_lead"}


# ============================================================ UNIDAD: password
class TestPasswordHashing:
    def test_roundtrip(self):
        h = hash_password("altis2025")
        assert verify_password("altis2025", h)

    def test_wrong_password_fails(self):
        h = hash_password("altis2025")
        assert not verify_password("nope", h)

    def test_salt_is_random(self):
        # mismo password → hashes distintos (salt aleatorio)
        assert hash_password("same") != hash_password("same")

    def test_format_is_pbkdf2(self):
        algo, iters, salt, digest = hash_password("x").split("$")
        assert algo == "pbkdf2_sha256"
        assert int(iters) >= 100_000
        assert len(salt) == 32 and len(digest) == 64  # 16 bytes salt, 32 bytes hash

    @pytest.mark.parametrize("garbage", ["", "plain", "a$b$c", "wrong$1$2$3"])
    def test_malformed_stored_hash_is_false(self, garbage):
        assert not verify_password("whatever", garbage)


# ================================================================ UNIDAD: JWT
class TestJWT:
    def test_roundtrip_carries_claims(self):
        token = create_access_token({"id": 7, "email": "a@b.com", "role": "opco_md", "opco": "Opco_B"})
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        assert payload["sub"] == "7"
        assert payload["role"] == "opco_md"
        assert payload["opco"] == "Opco_B"
        assert payload["exp"] > payload["iat"]

    def test_unscoped_role_has_null_opco(self):
        token = create_access_token(FAKE_USER)
        assert jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])["opco"] is None


# ============================================================== UNIDAD: roles
class TestRolesConfig:
    def test_exactly_the_four_roles(self):
        assert set(ROLES) == EXPECTED_ROLES

    def test_scoped_flag_matches_product_spec(self):
        for role, meta in ROLES.items():
            assert meta["scoped_to_opco"] is (role in SCOPED_ROLES)

    def test_every_role_has_home_and_views(self):
        for meta in ROLES.values():
            assert meta["home"].startswith("/")
            assert meta["views"], "cada rol debe declarar al menos una vista"
            assert meta["description"]


# ========================================================= UNIDAD: public_user
class TestPublicUser:
    def test_never_leaks_password_hash(self):
        out = public_user({**FAKE_USER, "password_hash": "secret", "full_name": "X"})
        assert "password_hash" not in out

    def test_enriches_with_role_metadata(self):
        out = public_user({**FAKE_USER, "full_name": "X"})
        assert out["role_label"] == "CFO"
        assert out["home"] == "/forecast"
        assert out["views"] == ROLES["cfo"]["views"]


# =========================================== UNIDAD: require_roles (guard) ====
class TestRequireRolesGuard:
    """El guard se monta en una app mínima y se ejerce vía HTTP real."""

    @pytest.fixture(scope="class")
    def guarded_client(self):
        sub = FastAPI()

        @sub.get("/cfo-only")
        def _cfo_only(user: dict = Depends(require_roles("cfo"))):
            return {"ok": True, "role": user["role"]}

        # override de la dependency: inyecta el usuario sin pasar por la DB
        def _fake_user():
            return _fake_user.current

        _fake_user.current = FAKE_USER
        sub.dependency_overrides[get_current_user] = _fake_user
        c = TestClient(sub)
        c._set_user = lambda u: setattr(_fake_user, "current", u)  # helper de test
        return c

    def test_allowed_role_passes(self, guarded_client):
        guarded_client._set_user({**FAKE_USER, "role": "cfo"})
        r = guarded_client.get("/cfo-only")
        assert r.status_code == 200 and r.json()["role"] == "cfo"

    def test_forbidden_role_gets_403(self, guarded_client):
        guarded_client._set_user({**FAKE_USER, "role": "project_lead"})
        r = guarded_client.get("/cfo-only")
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "FORBIDDEN"


# ====================================================== INTEGRACIÓN: /login ===
class TestLoginEndpoint:
    @pytest.mark.parametrize(
        "email,role,opco",
        [
            ("board@altis.com", "pe_board", None),
            ("cfo@altis.com", "cfo", None),
            ("md@altis.com", "opco_md", "Opco_A"),
            ("lead@altis.com", "project_lead", "Opco_A"),
        ],
    )
    def test_login_each_role(self, client, seeded, email, role, opco):
        r = client.post("/api/auth/login", json={"email": email, "password": "altis2025"})
        assert r.status_code == 200
        body = r.json()
        assert body["token_type"] == "bearer" and body["access_token"]
        u = body["user"]
        assert u["role"] == role
        assert u["opco"] == opco
        assert u["home"] == ROLES[role]["home"]
        assert "password_hash" not in u

    def test_wrong_password(self, client, seeded):
        r = client.post("/api/auth/login", json={"email": "cfo@altis.com", "password": "bad"})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "INVALID_CREDENTIALS"

    def test_unknown_email(self, client, seeded):
        r = client.post("/api/auth/login", json={"email": "ghost@altis.com", "password": "altis2025"})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "INVALID_CREDENTIALS"

    def test_email_is_case_insensitive(self, client, seeded):
        r = client.post("/api/auth/login", json={"email": "CFO@ALTIS.COM", "password": "altis2025"})
        assert r.status_code == 200 and r.json()["user"]["role"] == "cfo"


# ========================================================= INTEGRACIÓN: /me ===
class TestMeEndpoint:
    def test_me_with_valid_token(self, client, auth_headers):
        r = client.get("/api/auth/me", headers=auth_headers("cfo@altis.com"))
        assert r.status_code == 200 and r.json()["email"] == "cfo@altis.com"

    def test_me_without_token(self, client, seeded):
        r = client.get("/api/auth/me")
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "NOT_AUTHENTICATED"

    def test_me_with_garbage_token(self, client, seeded):
        r = client.get("/api/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "INVALID_TOKEN"

    def test_me_with_expired_token(self, client, seeded):
        users = {u["email"]: u for u in seeded}
        token = create_access_token(users["cfo@altis.com"], expires_delta=timedelta(seconds=-1))
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "TOKEN_EXPIRED"

    def test_me_with_token_signed_by_wrong_secret(self, client, seeded):
        # secret incorrecto pero de longitud válida (≥32 bytes) para no emitir warning
        token = jwt.encode({"sub": "1", "role": "cfo"}, "wrong-secret-" + "x" * 32, algorithm=JWT_ALGORITHM)
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 401
        assert r.json()["detail"]["code"] == "INVALID_TOKEN"


# ====================================================== INTEGRACIÓN: /roles ===
class TestRolesEndpoint:
    def test_lists_all_roles(self, client, seeded):
        r = client.get("/api/auth/roles")
        assert r.status_code == 200
        roles = {x["role"] for x in r.json()["roles"]}
        assert roles == EXPECTED_ROLES
