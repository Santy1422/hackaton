"""Guards de autorización sobre los endpoints de datos.

Verifica la matriz de roles de docs/AUTH.md:
- sin token            → 401
- rol no permitido     → 403
- rol permitido        → pasa el guard (no 401/403; puede ser 200 o 404 según datos)
- roles scoped         → sólo su propio opco (otro opco → 403)

No asume que el forecast esté computado: para los casos permitidos sólo
comprobamos que la auth no bloquea (status not in {401, 403}).
"""

from __future__ import annotations

BOARD = "board@altis.com"  # pe_board, sin opco
CFO = "cfo@altis.com"  # cfo, sin opco
MD = "md@altis.com"  # opco_md, Opco_A
LEAD = "lead@altis.com"  # project_lead, Opco_A

OTHER_OPCO = "Opco_B"  # distinto al de los seed users (Opco_A)
OWN_OPCO = "Opco_A"


def _allowed(client, path, headers) -> bool:
    """True si la request supera el guard de auth.

    Las dependencias de auth corren ANTES del cuerpo del handler, así que un
    rechazo de auth siempre es 401/403 (HTTPException → response). Cualquier otro
    status —o incluso una excepción del handler (p.ej. esquema de BD desfasado)—
    significa que la autorización ya se concedió.
    """
    try:
        return client.get(path, headers=headers).status_code not in (401, 403)
    except Exception:
        return True  # excepción en el body ⇒ el guard ya dejó pasar


# --- 401: sin token -----------------------------------------------------------
def test_protected_endpoints_require_auth(client):
    for path in [
        "/api/forecast/base",
        "/api/forecast/base/Opco_A",
        "/api/covenant/base",
        "/api/audit/week/base/1",
        "/api/wip/Opco_A",
        "/api/weather",
        "/api/milestones/Opco_A",
        "/api/actuals/monthly",
        "/api/stats",
        "/api/gl-mapping",
    ]:
        r = client.get(path)
        assert r.status_code == 401, f"{path} debería exigir auth, dio {r.status_code}"
        assert r.json()["detail"]["code"] == "NOT_AUTHENTICATED"


def test_health_is_public(client):
    # /health no lleva guard (health checks).
    assert client.get("/api/health").status_code in (200, 500)


# --- consolidado cross-opco: sólo pe_board / cfo ------------------------------
def test_forecast_portfolio_allows_board_and_cfo(client, auth_headers):
    assert _allowed(client, "/api/forecast/base", auth_headers(CFO))
    assert _allowed(client, "/api/forecast/base", auth_headers(BOARD))


def test_forecast_portfolio_forbids_scoped_roles(client, auth_headers):
    for email in (MD, LEAD):
        r = client.get("/api/forecast/base", headers=auth_headers(email))
        assert r.status_code == 403
        assert r.json()["detail"]["code"] == "FORBIDDEN"


def test_covenant_forbids_scoped_roles(client, auth_headers):
    assert client.get("/api/covenant/base", headers=auth_headers(MD)).status_code == 403
    assert _allowed(client, "/api/covenant/base", auth_headers(BOARD))


def test_audit_forbids_scoped_roles(client, auth_headers):
    assert client.get("/api/audit/week/base/1", headers=auth_headers(LEAD)).status_code == 403
    assert _allowed(client, "/api/audit/week/base/1", auth_headers(CFO))


def test_actuals_monthly_forbids_scoped_roles(client, auth_headers):
    assert client.get("/api/actuals/monthly", headers=auth_headers(MD)).status_code == 403
    assert _allowed(client, "/api/actuals/monthly", auth_headers(CFO))


# --- opco scoping -------------------------------------------------------------
def test_scoped_role_can_access_own_opco(client, auth_headers):
    # opco_md sobre su propio opco (Opco_A): no bloqueado por auth.
    assert _allowed(client, f"/api/wip/{OWN_OPCO}", auth_headers(MD))
    assert _allowed(client, f"/api/milestones/{OWN_OPCO}", auth_headers(LEAD))
    assert _allowed(client, f"/api/forecast/base/{OWN_OPCO}", auth_headers(MD))


def test_scoped_role_blocked_from_other_opco(client, auth_headers):
    r = client.get(f"/api/wip/{OTHER_OPCO}", headers=auth_headers(MD))
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "FORBIDDEN_OPCO"

    r = client.get(f"/api/milestones/{OTHER_OPCO}", headers=auth_headers(LEAD))
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "FORBIDDEN_OPCO"

    r = client.get(f"/api/forecast/base/{OTHER_OPCO}", headers=auth_headers(LEAD))
    assert r.status_code == 403
    assert r.json()["detail"]["code"] == "FORBIDDEN_OPCO"


def test_unscoped_role_sees_any_opco(client, auth_headers):
    # cfo no está scoped → puede pedir cualquier opco.
    assert _allowed(client, f"/api/wip/{OTHER_OPCO}", auth_headers(CFO))
    assert _allowed(client, f"/api/forecast/base/{OTHER_OPCO}", auth_headers(BOARD))


# --- wip: project_lead no tiene esa vista -------------------------------------
def test_wip_forbids_project_lead(client, auth_headers):
    assert client.get(f"/api/wip/{OWN_OPCO}", headers=auth_headers(LEAD)).status_code == 403


# --- gobierno de datos / mutaciones: sólo cfo ---------------------------------
def test_gl_mapping_and_recompute_are_cfo_only(client, auth_headers):
    assert client.get("/api/gl-mapping", headers=auth_headers(BOARD)).status_code == 403
    assert _allowed(client, "/api/gl-mapping", auth_headers(CFO))
    assert client.post("/api/recompute", headers=auth_headers(MD)).status_code == 403


# --- endpoints compartidos: cualquier autenticado ----------------------------
def test_shared_endpoints_allow_any_authenticated(client, auth_headers):
    for email in (BOARD, CFO, MD, LEAD):
        assert _allowed(client, "/api/stats", auth_headers(email))
        assert _allowed(client, "/api/weather", auth_headers(email))
