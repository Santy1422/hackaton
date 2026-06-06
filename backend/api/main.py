"""Entry point de la API de Altis Forecast."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import forecast, ingestion, traceability

app = FastAPI(title="Altis Forecast API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion.router)
app.include_router(forecast.router)
app.include_router(traceability.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
