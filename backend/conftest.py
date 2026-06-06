"""Fixtures compartidas de pytest.

Vive en la raíz del backend para que pytest agregue este directorio a sys.path
y `import api`, `import db` funcionen sin hacks de path en cada test.
"""

from __future__ import annotations

import psycopg
import pytest
from fastapi.testclient import TestClient

from api.main import app


@pytest.fixture(scope="session")
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture(scope="session")
def seeded():
    """Garantiza los 4 usuarios base en la DB. Skip si Postgres no está disponible."""
    from db.seed_users import seed_users

    try:
        return seed_users()
    except psycopg.OperationalError as e:  # DB remota caída → no es fallo del código
        pytest.skip(f"Postgres no disponible: {e}")


@pytest.fixture
def auth_headers(client, seeded):
    """Factory reusable: `auth_headers('cfo@altis.com')` → {'Authorization': 'Bearer ...'}.

    Sirve para testear cualquier endpoint protegido por rol más adelante.
    """
    from db.seed_users import DEMO_PASSWORD

    def _make(email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
        r = client.post("/api/auth/login", json={"email": email, "password": password})
        assert r.status_code == 200, f"login falló para {email}: {r.text}"
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    return _make
