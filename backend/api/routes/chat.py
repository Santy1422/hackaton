"""Chat endpoint — natural language Q&A over Altis DB via local Ollama LLM."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import get_current_user
from ..validation import OPCOS, SCENARIOS, err

router = APIRouter(tags=["chat"])


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)
    scenario: str = Field("base", description="base | wet_qtr | dry_qtr")
    opco: str | None = Field(None, description="Opco_A | Opco_B | Opco_C | Opco_D | null for portfolio")
    model: str = Field("llama3.2", description="Ollama model name")


class ChatResponse(BaseModel):
    answer: str
    scenario: str
    opco: str | None
    model: str


@router.post("", response_model=ChatResponse)
def chat_endpoint(body: ChatRequest, user: dict = Depends(get_current_user)):
    if body.scenario not in SCENARIOS:
        raise HTTPException(400, detail=err("INVALID_SCENARIO", f"scenario must be one of {SCENARIOS}"))
    if body.opco and body.opco not in OPCOS:
        raise HTTPException(400, detail=err("INVALID_OPCO", f"opco must be one of {OPCOS} or null"))

    try:
        from services.llm import chat
        answer = chat(body.question.strip(), scenario=body.scenario, opco=body.opco, model=body.model)
    except RuntimeError as e:
        raise HTTPException(503, detail=err("OLLAMA_UNAVAILABLE", str(e)))
    except Exception as e:
        raise HTTPException(500, detail=err("LLM_ERROR", f"Unexpected error: {e}"))

    return ChatResponse(answer=answer, scenario=body.scenario, opco=body.opco, model=body.model)


@router.get("/models")
def list_models(user: dict = Depends(get_current_user)):
    """List locally available Ollama models."""
    from services.llm import list_ollama_models
    models = list_ollama_models()
    return {
        "models": models,
        "default": "llama3.2",
        "ollama_running": len(models) > 0,
        "hint": "Install: brew install ollama && ollama pull llama3.2" if not models else None,
    }
