"""Autenticación: roles, hashing de password, JWT y dependency de usuario actual.

Cuatro roles, cada uno con su vista específica de roofing / private equity:

  pe_board      → covenant headroom + portfolio consolidado
  cfo           → forecast 13w por driver, toggles de escenario, cross-opco
  opco_md       → WIP de su opco + señales de riesgo a nivel proyecto
  project_lead  → próximo milestone facturable, outflows de materiales, riesgo clima
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer

from db.database import get_connection, query

from .validation import err

# --- Config JWT ---------------------------------------------------------------
JWT_SECRET = os.getenv("JWT_SECRET", "altis-dev-secret-change-me")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "12"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# --- Definición de roles ------------------------------------------------------
# `home` = ruta por defecto del frontend; `views` = capacidades que ve cada rol.
ROLES: dict[str, dict] = {
    "pe_board": {
        "label": "PE Board",
        "home": "/portfolio",
        "scoped_to_opco": False,
        "description": "Covenant headroom before a board meeting; consolidated portfolio view",
        "views": ["covenant_headroom", "portfolio_consolidated"],
    },
    "cfo": {
        "label": "CFO",
        "home": "/forecast",
        "scoped_to_opco": False,
        "description": "13-week cash flow forecast by driver; scenario toggles; cross-opco comparison",
        "views": ["cashflow_13w_by_driver", "scenario_toggles", "cross_opco_comparison"],
    },
    "opco_md": {
        "label": "Opco MD",
        "home": "/wip",
        "scoped_to_opco": True,
        "description": "WIP exposure for their operating company; project-level risk signals",
        "views": ["wip_exposure", "project_risk_signals"],
    },
    "project_lead": {
        "label": "Project Lead",
        "home": "/project",
        "scoped_to_opco": True,
        "description": "Next invoiceable milestone; materials outflows ahead of execution; schedule risk from weather",
        "views": ["next_milestone", "materials_outflow", "weather_schedule_risk"],
    },
}


# --- Password hashing (pbkdf2, stdlib — sin deps nativas) ---------------------
def hash_password(password: str) -> str:
    """Devuelve `pbkdf2_sha256$<iter>$<salt_hex>$<hash_hex>`."""
    iterations = 200_000
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, AttributeError):
        return False


# --- JWT ----------------------------------------------------------------------
def create_access_token(user: dict, expires_delta: timedelta | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user["id"]),
        "email": user["email"],
        "role": user["role"],
        "opco": user.get("opco"),
        "iat": now,
        "exp": now + (expires_delta or timedelta(hours=JWT_EXPIRE_HOURS)),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, detail=err("TOKEN_EXPIRED", "Session expired. Log in again."))
    except jwt.PyJWTError:
        raise HTTPException(401, detail=err("INVALID_TOKEN", "Invalid authentication token."))


# --- Dependencies -------------------------------------------------------------
def get_current_user(token: str | None = Depends(oauth2_scheme)) -> dict:
    """Resuelve el usuario autenticado desde el JWT (Authorization: Bearer ...)."""
    if not token:
        raise HTTPException(
            401,
            detail=err("NOT_AUTHENTICATED", "Missing bearer token.", "Send Authorization: Bearer <token>"),
        )
    payload = _decode_token(token)
    con = get_connection()
    rows = query(
        con,
        "SELECT id, email, full_name, role, opco, is_active FROM users WHERE id = ?",
        [int(payload["sub"])],
    )
    con.close()
    if not rows or not rows[0]["is_active"]:
        raise HTTPException(401, detail=err("USER_INACTIVE", "User not found or inactive."))
    return rows[0]


def require_roles(*roles: str):
    """Dependency factory: limita un endpoint a ciertos roles."""

    def _checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(
                403,
                detail=err(
                    "FORBIDDEN",
                    f"Role '{user['role']}' cannot access this view.",
                    f"Allowed: {', '.join(roles)}",
                ),
            )
        return user

    return _checker


def enforce_opco_scope(user: dict, opco: str) -> None:
    """Para roles scoped (opco_md, project_lead), restringe el acceso a su propio opco.

    pe_board y cfo no están scoped → ven cualquier opco. Llamar después de
    `validate_opco` en endpoints con `{opco}` en el path.
    """
    if ROLES.get(user["role"], {}).get("scoped_to_opco") and user.get("opco") != opco:
        raise HTTPException(
            403,
            detail=err(
                "FORBIDDEN_OPCO",
                f"Role '{user['role']}' is scoped to {user.get('opco')}.",
                f"You cannot access data for {opco}.",
            ),
        )


def public_user(user: dict) -> dict:
    """Forma segura del usuario para devolver al cliente (sin password_hash)."""
    role_meta = ROLES.get(user["role"], {})
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user.get("full_name"),
        "role": user["role"],
        "role_label": role_meta.get("label", user["role"]),
        "opco": user.get("opco"),
        "home": role_meta.get("home", "/"),
        "scoped_to_opco": role_meta.get("scoped_to_opco", False),
        "views": role_meta.get("views", []),
        "description": role_meta.get("description", ""),
    }
