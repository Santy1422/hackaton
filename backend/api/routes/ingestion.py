"""Endpoints de ingesta: subir exports de cada sistema de origen."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/ingestion", tags=["ingestion"])


@router.get("/systems")
def list_systems():
    return {"systems": ["gilde", "yuki", "exact", "snelstart"]}
