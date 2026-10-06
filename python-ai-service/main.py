"""SupportFlow RAG service contract.

This lightweight boilerplate mirrors the production split: document ingestion,
retrieval-grounded answers, citations, confidence scoring, and health checks.
"""
from typing import Any

from fastapi import FastAPI, UploadFile
from pydantic import BaseModel, Field

app = FastAPI(title="SupportFlow AI Service", version="0.1.0")


class RagRequest(BaseModel):
    tenant_id: str
    conversation_id: str
    query: str = Field(min_length=1)
    top_k: int = Field(default=4, ge=3, le=5)


class RagResponse(BaseModel):
    message: str
    confidence_score: float
    citations: list[str]
    should_handoff: bool


@app.get("/api/v1/health")
def health() -> dict[str, Any]:
    return {"ok": True, "service": "supportflow-rag", "vector_store": "pgvector"}


@app.post("/api/v1/ingest")
async def ingest(document: UploadFile, tenant_id: str) -> dict[str, Any]:
    return {
        "tenant_id": tenant_id,
        "document": document.filename,
        "status": "QUEUED",
        "chunking": {"target_tokens": "500-1000", "overlap_tokens": 100},
        "embedding_model": "text-embedding-3-small",
    }


@app.post("/api/v1/chat/rag", response_model=RagResponse)
def rag_answer(request: RagRequest) -> RagResponse:
    # Production implementation: pgvector cosine search -> guarded prompt -> LLM response.
    confidence = 0.86
    return RagResponse(
        message="Grounded response placeholder based on the top retrieved support sources.",
        confidence_score=confidence,
        citations=["shipping-policy.pdf", "order-support-playbook.md"],
        should_handoff=confidence < 0.70,
    )
