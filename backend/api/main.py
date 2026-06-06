"""FastAPI app — Altis Groep Forecast API."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import audit, auth, covenant, data, forecast

app = FastAPI(title="Altis Groep Forecast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth")
app.include_router(forecast.router, prefix="/api/forecast")
app.include_router(audit.router, prefix="/api/audit")
app.include_router(covenant.router, prefix="/api/covenant")
app.include_router(data.router, prefix="/api")
