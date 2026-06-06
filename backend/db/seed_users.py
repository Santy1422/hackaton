"""Seed de los 4 usuarios base (uno por rol).

Uso:  python -m db.seed_users   |   python run.py seed

Idempotente: hace UPSERT por email (no duplica si ya existen).
Password de demo compartido para los 4: `altis2025`
"""

from __future__ import annotations

from db.database import execute, get_connection, init_schema, query

from api.auth import hash_password

DEMO_PASSWORD = "altis2025"

# (email, full_name, role, opco)
SEED_USERS = [
    ("board@altis.com", "Pieter de Vries", "pe_board", None),
    ("cfo@altis.com", "Sandra Bakker", "cfo", None),
    ("md@altis.com", "Johan Mulder", "opco_md", "Opco_A"),
    ("lead@altis.com", "Eva Janssen", "project_lead", "Opco_A"),
]


def seed_users() -> list[dict]:
    con = get_connection()
    init_schema(con)  # asegura que la tabla users exista

    for email, full_name, role, opco in SEED_USERS:
        pwd_hash = hash_password(DEMO_PASSWORD)
        execute(
            con,
            "INSERT INTO users (email, full_name, password_hash, role, opco, is_active) "
            "VALUES (?, ?, ?, ?, ?, TRUE) "
            "ON CONFLICT (email) DO UPDATE SET "
            "full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, "
            "role = EXCLUDED.role, opco = EXCLUDED.opco, is_active = TRUE",
            [email.lower(), full_name, pwd_hash, role, opco],
        )

    rows = query(con, "SELECT id, email, full_name, role, opco FROM users ORDER BY id")
    con.close()
    return rows


if __name__ == "__main__":
    users = seed_users()
    print(f"✅ Seeded {len(users)} users (password: {DEMO_PASSWORD!r})")
    for u in users:
        scope = f"  [{u['opco']}]" if u["opco"] else ""
        print(f"  • {u['email']:20s} {u['role']:14s}{scope}  — {u['full_name']}")
