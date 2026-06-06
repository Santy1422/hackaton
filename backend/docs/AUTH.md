# Authentication & Authorization

JWT-based auth for the Altis Groep Forecast API. Stateless bearer tokens, four
role-based views, password hashing with `pbkdf2_sha256` (stdlib — no native deps).

> **Flow at a glance:** `POST /api/auth/login` → returns a JWT + the user's
> role/scope/home view → frontend stores the token → sends it as
> `Authorization: Bearer <token>` on every subsequent request.

---

## The four roles

Each role gets a view specific to roofing / private equity, not a generic
dashboard. The token carries the role; the API and frontend use it to scope data.

| Role           | `role` key      | Scoped to opco? | Default view (`home`) | What they see |
|----------------|-----------------|-----------------|-----------------------|---------------|
| PE Board       | `pe_board`      | No              | `/portfolio`          | Covenant headroom before a board meeting; consolidated portfolio view |
| CFO            | `cfo`           | No              | `/forecast`           | 13-week cash flow forecast by driver; scenario toggles; cross-opco comparison |
| Opco MD        | `opco_md`       | Yes             | `/wip`                | WIP exposure for their operating company; project-level risk signals |
| Project Lead   | `project_lead`  | Yes             | `/project`            | Next invoiceable milestone; materials outflows ahead of execution; weather schedule risk |

`opco_md` and `project_lead` are **scoped**: their JWT carries an `opco`
(`Opco_A`…`Opco_D`) so the frontend/API can restrict data to that operating
company. `pe_board` and `cfo` see all opcos (`opco` is `null`).

Role metadata (label, home, views, scope) is defined once in
`api/auth.py → ROLES` and exposed via `GET /api/auth/roles`.

---

## Endpoints

All endpoints are mounted under `/api/auth`.

### `POST /api/auth/login`

Exchange email + password for a JWT.

**Request**
```json
{ "email": "cfo@altis.com", "password": "altis2025" }
```

**Response `200`**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 2,
    "email": "cfo@altis.com",
    "full_name": "Sandra Bakker",
    "role": "cfo",
    "role_label": "CFO",
    "opco": null,
    "home": "/forecast",
    "scoped_to_opco": false,
    "views": ["cashflow_13w_by_driver", "scenario_toggles", "cross_opco_comparison"],
    "description": "13-week cash flow forecast by driver; scenario toggles; cross-opco comparison"
  }
}
```

**Errors**
| Status | `code`                | When |
|--------|-----------------------|------|
| `401`  | `INVALID_CREDENTIALS` | Unknown email, wrong password, or inactive user |

> Email is matched case-insensitively (`CFO@ALTIS.COM` works).
> `password_hash` is **never** returned.

---

### `GET /api/auth/me`

Return the authenticated user's profile (same shape as `login.user`).
Requires `Authorization: Bearer <token>`.

**Response `200`** — identical shape to the `user` object above.

**Errors**
| Status | `code`             | When |
|--------|--------------------|------|
| `401`  | `NOT_AUTHENTICATED`| Missing bearer token |
| `401`  | `INVALID_TOKEN`    | Malformed token or wrong signature |
| `401`  | `TOKEN_EXPIRED`    | Token past its `exp` |
| `401`  | `USER_INACTIVE`    | User deleted or `is_active = false` |

---

### `GET /api/auth/roles`

Public catalog of all roles and the views each one sees. Useful for the frontend
to drive routing/menus without hard-coding role logic.

**Response `200`**
```json
{
  "roles": [
    {
      "role": "pe_board",
      "label": "PE Board",
      "home": "/portfolio",
      "scoped_to_opco": false,
      "description": "Covenant headroom before a board meeting; consolidated portfolio view",
      "views": ["covenant_headroom", "portfolio_consolidated"]
    }
    // ... cfo, opco_md, project_lead
  ]
}
```

---

## Error envelope

Every auth error uses the shared API error shape (`api/validation.py → err`):

```json
{ "error": true, "code": "INVALID_CREDENTIALS", "message": "Email or password is incorrect." }
```

Some errors add a `"hint"` field. Always branch on `code`, not on `message`.

---

## Seed users

Four demo users (one per role) — created by `db/seed_users.py`, idempotent
(UPSERT by email). Shared demo password: **`altis2025`**.

```bash
python run.py seed          # or:  python -m db.seed_users
```

| Email             | Role           | Opco     | Name |
|-------------------|----------------|----------|------|
| `board@altis.com` | `pe_board`     | —        | Pieter de Vries |
| `cfo@altis.com`   | `cfo`          | —        | Sandra Bakker |
| `md@altis.com`    | `opco_md`      | `Opco_A` | Johan Mulder |
| `lead@altis.com`  | `project_lead` | `Opco_A` | Eva Janssen |

---

## How JWT works here

- **Algorithm:** HS256. **Secret:** `JWT_SECRET` env var (defaults to a dev value
  — **set a real secret in production**).
- **Lifetime:** `JWT_EXPIRE_HOURS` env var (default `12`).
- **Claims:** `sub` (user id), `email`, `role`, `opco`, `iat`, `exp`.
- **Passwords:** `pbkdf2_sha256$<iterations>$<salt_hex>$<hash_hex>`, 200k
  iterations, random 16-byte salt, constant-time compare. No bcrypt/native deps.

Relevant config (env vars):

```bash
JWT_SECRET=change-me-in-prod
JWT_EXPIRE_HOURS=12
```

---

## Protecting other endpoints

Auth ships two reusable FastAPI dependencies (`api/auth.py`):

```python
from fastapi import Depends
from api.auth import get_current_user, require_roles

# Any authenticated user:
@router.get("/something")
def something(user: dict = Depends(get_current_user)):
    ...

# Restrict to specific roles (403 FORBIDDEN otherwise):
@router.get("/covenant/{scenario}")
def covenant(scenario: str, user: dict = Depends(require_roles("pe_board", "cfo"))):
    ...

# Scope data to the caller's opco for scoped roles:
@router.get("/wip")
def wip(user: dict = Depends(require_roles("opco_md", "project_lead"))):
    rows = query(con, "SELECT ... WHERE opco = ?", [user["opco"]])
    ...
```

> The existing data endpoints (`/wip`, `/covenant`, `/forecast`, …) are **not yet
> guarded** — add `Depends(get_current_user)` / `require_roles(...)` when you want
> to enforce the role scoping above.

---

## cURL examples

```bash
# 1. Login → grab the token
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"cfo@altis.com","password":"altis2025"}' | jq -r .access_token)

# 2. Call a protected endpoint
curl -s http://localhost:8000/api/auth/me -H "Authorization: Bearer $TOKEN" | jq

# 3. Public role catalog (no token)
curl -s http://localhost:8000/api/auth/roles | jq
```

---

## Tests

```bash
.venv/bin/pytest tests/test_auth.py -v
```

30 tests covering: password hashing (roundtrip, random salt, malformed input),
JWT claims, role config integrity, `public_user` (no hash leak), the
`require_roles` guard (allow/forbid), and every endpoint
(`/login`, `/me`, `/roles`) including expired/invalid/wrong-secret tokens.

Reusable fixture `auth_headers(email)` in `conftest.py` logs in and returns a
bearer header — use it to test future protected endpoints.
```python
def test_protected(client, auth_headers):
    r = client.get("/api/some-protected", headers=auth_headers("cfo@altis.com"))
    assert r.status_code == 200
```
