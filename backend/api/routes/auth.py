"""Endpoints de autenticación: login (JWT) + perfil del usuario actual + roles."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db.database import get_connection, query

from ..auth import (
    ROLES,
    create_access_token,
    get_current_user,
    public_user,
    verify_password,
)
from ..validation import err

router = APIRouter(tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/login")
def login(body: LoginRequest):
    con = get_connection()
    rows = query(
        con,
        "SELECT id, email, full_name, password_hash, role, opco, is_active "
        "FROM users WHERE email = ?",
        [body.email.lower()],
    )
    con.close()

    user = rows[0] if rows else None
    if not user or not user["is_active"] or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(
            401,
            detail=err("INVALID_CREDENTIALS", "Email or password is incorrect."),
        )

    token = create_access_token(user)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": public_user(user),
    }


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return public_user(user)


@router.get("/roles")
def list_roles():
    """Catálogo de roles + qué ve cada uno (útil para el frontend)."""
    return {
        "roles": [
            {
                "role": key,
                "label": meta["label"],
                "home": meta["home"],
                "scoped_to_opco": meta["scoped_to_opco"],
                "description": meta["description"],
                "views": meta["views"],
            }
            for key, meta in ROLES.items()
        ]
    }
