from __future__ import annotations

import json
import time
from typing import Any, Literal

import httpx
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    supabase_url: str
    supabase_publishable_key: str
    supabase_service_role_key: str
    ollama_base_url: str = "http://localhost:11434"
    ollama_main_model: str = "qwen3:8b"
    ollama_light_model: str = "qwen3:4b"
    allowed_origins: str = "http://localhost:3000"


settings = Settings()
admin: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
app = FastAPI(title="Ritmo AI Gateway", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[item.strip() for item in settings.allowed_origins.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["authorization", "content-type", "idempotency-key"],
)


class Identity(BaseModel):
    user_id: str
    token: str


async def identity(authorization: str = Header(...)) -> Identity:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sessão inválida")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(token, options={"verify_signature": False, "verify_exp": True}, algorithms=["RS256", "HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise ValueError()
        # Supabase performs the authoritative token check; decoded claims are never trusted alone.
        verified = admin.auth.get_user(token)
        if not verified.user or str(verified.user.id) != user_id:
            raise ValueError()
        return Identity(user_id=user_id, token=token)
    except Exception as exc:
        raise HTTPException(401, "Sessão expirada") from exc


class ChatRequest(BaseModel):
    conversation_id: str
    message: str = Field(min_length=1, max_length=8000)
    context_scope: str | None = None


class JobRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


async def compact_context(user_id: str) -> str:
    profile = admin.table("profiles").select("context").eq("user_id", user_id).maybe_single().execute()
    memories = admin.table("creator_memories").select("category,content,confidence,status").eq("user_id", user_id).in_("status", ["confirmed", "pinned"]).limit(20).execute()
    return json.dumps({"perfil": profile.data or {}, "memorias": memories.data or []}, ensure_ascii=False)


async def ollama_stream(messages: list[dict[str, str]]):
    payload = {"model": settings.ollama_main_model, "messages": messages, "stream": True}
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream("POST", f"{settings.ollama_base_url}/api/chat", json=payload) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                item = json.loads(line)
                text = item.get("message", {}).get("content", "")
                if text:
                    yield f"data: {json.dumps({'delta': text}, ensure_ascii=False)}\n\n"
            yield "event: done\ndata: {}\n\n"


@app.get("/v1/health")
async def health():
    return {"status": "ok", "service": "ritmo-ai"}


@app.get("/v1/models/status")
async def model_status(_: Identity = Depends(identity)):
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            result = await client.get(f"{settings.ollama_base_url}/api/tags")
            result.raise_for_status()
        return {"available": True, "main_model": settings.ollama_main_model}
    except httpx.HTTPError:
        return {"available": False, "main_model": settings.ollama_main_model}


@app.post("/v1/chat/stream")
async def chat(request: ChatRequest, user: Identity = Depends(identity)):
    user_message = {
        "user_id": user.user_id, "conversation_id": request.conversation_id,
        "role": "user", "content": request.message, "status": "completed"
    }
    admin.table("messages").insert(user_message).execute()
    context = await compact_context(user.user_id)
    system = (
        "Você é o copiloto Ritmo, especialista brasileiro em conteúdo para TikTok e Instagram. "
        "Seja prático, acolhedor e honesto; nunca prometa viralização. Sugira mudanças, mas nunca afirme que as aplicou. "
        f"Contexto autorizado e compacto do criador: {context}"
    )
    return StreamingResponse(
        ollama_stream([{"role": "system", "content": system}, {"role": "user", "content": request.message}]),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def enqueue(kind: str, request: JobRequest, user: Identity, idempotency_key: str | None):
    key = idempotency_key or f"{kind}:{user.user_id}:{int(time.time())}"
    record = {
        "user_id": user.user_id, "kind": kind, "payload": request.payload,
        "idempotency_key": key, "status": "queued"
    }
    result = admin.table("ai_jobs").upsert(record, on_conflict="user_id,idempotency_key", ignore_duplicates=True).execute()
    return {"job": result.data[0] if result.data else None, "idempotency_key": key}


@app.post("/v1/plans/generate")
async def generate_plan(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("plan.generate", request, user, idempotency_key)


@app.post("/v1/plans/revise")
async def revise_plan(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("plan.revise", request, user, idempotency_key)


@app.post("/v1/content/generate")
async def generate_content(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("content.generate", request, user, idempotency_key)


@app.post("/v1/content/revise")
async def revise_content(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("content.revise", request, user, idempotency_key)


@app.post("/v1/trends/research")
async def research_trends(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("trends.research", request, user, idempotency_key)


@app.post("/v1/memories/extract")
async def extract_memories(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("memories.extract", request, user, idempotency_key)


@app.post("/v1/conversations/summarize")
async def summarize(request: JobRequest, user: Identity = Depends(identity), idempotency_key: str | None = Header(None)):
    return await enqueue("conversations.summarize", request, user, idempotency_key)


@app.get("/v1/jobs/{job_id}")
async def get_job(job_id: str, user: Identity = Depends(identity)):
    result = admin.table("ai_jobs").select("id,kind,status,progress,result,error_code,created_at,updated_at").eq("id", job_id).eq("user_id", user.user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(404, "Trabalho não encontrado")
    return result.data


@app.post("/v1/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user: Identity = Depends(identity)):
    result = admin.table("ai_jobs").update({"status": "cancelled"}).eq("id", job_id).eq("user_id", user.user_id).in_("status", ["queued", "waiting_retry"]).execute()
    return {"cancelled": bool(result.data)}
