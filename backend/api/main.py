"""FastAPI app — Altis Groep Forecast API."""

import logging
import os
from contextlib import asynccontextmanager

# Logs visibles en Railway (INFO): envíos de WhatsApp, webhook, bot.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import (
    audit,
    auth,
    covenant,
    data,
    forecast,
    insights,
    notify,
    reports,
    savings,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Schema idempotente al arrancar (CREATE TABLE IF NOT EXISTS). Best-effort.
    try:
        from db.database import get_connection, init_schema

        con = get_connection()
        init_schema(con)
        con.close()
    except Exception:
        pass
    # Crons de WhatsApp (solo si ENABLE_SCHEDULER=1).
    try:
        from scheduler import start_scheduler

        start_scheduler()
    except Exception:
        pass
    yield


app = FastAPI(title="Altis Groep Forecast API", lifespan=lifespan)

# Orígenes permitidos: CORS_ORIGINS (coma-separados) en prod; localhost en dev.
# Además, por regex, cualquier subdominio de Railway → el frontend deploya y habla
# con el backend sin tener que conocer/fijar el subdominio exacto.
_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _origins.split(",") if o.strip()],
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth")
app.include_router(insights.router, prefix="/api/insights")
app.include_router(forecast.router, prefix="/api/forecast")
app.include_router(audit.router, prefix="/api/audit")
app.include_router(covenant.router, prefix="/api/covenant")
app.include_router(savings.router, prefix="/api/savings")
app.include_router(reports.router, prefix="/api/reports")
app.include_router(notify.router, prefix="/api/notify")
app.include_router(data.router, prefix="/api")
