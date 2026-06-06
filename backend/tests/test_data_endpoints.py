"""Tests de endpoints data-driven: /opcos, /sources, /notify/automations.

Todo sale de la DB (sin hardcode): se valida forma, scoping por rol, y que el
toggle de automations persista por usuario.
"""

from __future__ import annotations

CFO = "cfo@altis.com"
BOARD = "board@altis.com"
MD = "md@altis.com"
LEAD = "lead@altis.com"


# --- /opcos -----------------------------------------------------------------
def test_opcos_requires_auth(client):
    assert client.get("/api/opcos").status_code == 401


def test_opcos_lists_real_opcos(client, auth_headers):
    r = client.get("/api/opcos", headers=auth_headers(CFO))
    assert r.status_code == 200
    opcos = r.json()["opcos"]
    assert len(opcos) >= 1
    for o in opcos:
        assert {"id", "name", "transactions", "revenue", "share"} <= set(o)
        assert 0 <= o["share"] <= 1
    # las cuotas de revenue suman ~1 (data-driven, no hardcode)
    assert sum(o["share"] for o in opcos) <= 1.02


def test_opcos_forbidden_for_scoped_roles(client, auth_headers):
    assert client.get("/api/opcos", headers=auth_headers(MD)).status_code == 403
    assert client.get("/api/opcos", headers=auth_headers(LEAD)).status_code == 403


# --- /sources ---------------------------------------------------------------
def test_sources_requires_auth(client):
    assert client.get("/api/sources").status_code == 401


def test_sources_shape(client, auth_headers):
    r = client.get("/api/sources", headers=auth_headers(BOARD))
    assert r.status_code == 200
    d = r.json()
    assert {"systems", "total_transactions", "gl_accounts_mapped"} <= set(d)
    assert isinstance(d["systems"], list)
    if d["systems"]:
        assert {"system", "transactions"} <= set(d["systems"][0])


# --- /notify/automations ----------------------------------------------------
def test_automations_requires_auth(client):
    assert client.get("/api/notify/automations").status_code == 401


def test_automations_catalog_and_defaults(client, auth_headers):
    r = client.get("/api/notify/automations", headers=auth_headers(CFO))
    assert r.status_code == 200
    autos = r.json()["automations"]
    ids = {a["id"] for a in autos}
    assert {"weekly_digest", "covenant_alert", "monthly_report"} <= ids
    for a in autos:
        assert {"id", "label", "schedule", "enabled"} <= set(a)
        assert isinstance(a["enabled"], bool)


def test_automations_any_authenticated_role(client, auth_headers):
    # el onboarding (y por tanto las automations) lo ven los 4 roles
    for email in (CFO, BOARD, MD, LEAD):
        assert client.get("/api/notify/automations", headers=auth_headers(email)).status_code == 200


def test_automations_toggle_persists_per_user(client, auth_headers):
    h = auth_headers(CFO)
    try:
        r = client.post("/api/notify/automations", headers=h, json={"id": "monthly_report", "enabled": True})
        assert r.status_code == 200
        assert any(a["id"] == "monthly_report" and a["enabled"] for a in r.json()["automations"])
        # persiste en un GET nuevo
        r2 = client.get("/api/notify/automations", headers=h)
        assert any(a["id"] == "monthly_report" and a["enabled"] for a in r2.json()["automations"])
    finally:
        client.post("/api/notify/automations", headers=h, json={"id": "monthly_report", "enabled": False})


def test_automations_unknown_id_404(client, auth_headers):
    r = client.post(
        "/api/notify/automations", headers=auth_headers(CFO), json={"id": "does_not_exist", "enabled": True}
    )
    assert r.status_code == 404
    assert r.json()["detail"]["code"] == "UNKNOWN_AUTOMATION"
