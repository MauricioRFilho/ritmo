from __future__ import annotations

import json
import time
from typing import Any

import httpx
import jwt
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict
from supabase import Client, create_client

from app.observability import configure_api_logging


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    supabase_url: str
    supabase_publishable_key: str
    supabase_service_role_key: str
    ollama_base_url: str = "http://localhost:11434"
    ollama_main_model: str = "qwen3:8b"
    ollama_light_model: str = "qwen3:4b"
    allowed_origins: str = "http://localhost:3000"
    hourly_job_limit: int = 30


settings = Settings()
admin: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
app = FastAPI(title="Ritmo AI Gateway", version="0.2.0")
configure_api_logging(app, "ai-gateway")
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


class ChatRequest(BaseModel):
    conversation_id: str
    message: str = Field(min_length=1, max_length=8000)
    context_scope: str | None = None


class JobRequest(BaseModel):
    payload: dict[str, Any] = Field(default_factory=dict)


async def identity(authorization: str = Header(...)) -> Identity:
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sessão inválida")
    token = authorization.removeprefix("Bearer ").strip()
    try:
        payload = jwt.decode(
            token,
            options={"verify_signature": False, "verify_exp": True},
            algorithms=["RS256", "HS256"],
        )
        user_id = payload.get("sub")
        verified = admin.auth.get_user(token)
        if not user_id or not verified.user or str(verified.user.id) != user_id:
            raise ValueError()
        return Identity(user_id=user_id, token=token)
    except Exception as exc:
        raise HTTPException(401, "Sessão expirada") from exc


async def compact_context(user_id: str) -> str:
    profile = admin.table("profiles").select(
        "context,account_mode,timezone,locale"
    ).eq("user_id", user_id).maybe_single().execute()
    preferences = admin.table("creator_preferences").select(
        "category,value,niche_id"
    ).eq("user_id", user_id).limit(30).execute()
    memories = admin.table("creator_memories").select(
        "id,category,content,confidence,status"
    ).eq("user_id", user_id).in_("status", ["confirmed", "pinned"]).limit(20).execute()
    return json.dumps({
        "perfil": profile.data or {},
        "preferencias": preferences.data or [],
        "memorias": memories.data or [],
    }, ensure_ascii=False)


async def ollama_stream(
    messages: list[dict[str, str]], user_id: str, conversation_id: str
):
    payload = {"model": settings.ollama_main_model, "messages": messages, "stream": True}
    parts: list[str] = []
    try:
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream(
                "POST", f"{settings.ollama_base_url}/api/chat", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    item = json.loads(line)
                    text = item.get("message", {}).get("content", "")
                    if text:
                        parts.append(text)
                        yield f"data: {json.dumps({'delta': text}, ensure_ascii=False)}\n\n"
        if parts:
            assistant_message = admin.table("messages").insert({
                "user_id": user_id,
                "conversation_id": conversation_id,
                "role": "assistant",
                "content": "".join(parts),
                "status": "completed",
            }).execute()
            message_id = assistant_message.data[0]["id"]
            admin.table("ai_jobs").insert({
                "user_id": user_id,
                "kind": "memories.extract",
                "status": "queued",
                "payload": {
                    "conversation_id": conversation_id,
                    "assistant_message_id": message_id,
                    "excerpt": "".join(parts)[-4000:],
                },
                "idempotency_key": f"memory:{message_id}",
            }).execute()
        yield "event: done\ndata: {}\n\n"
    except Exception:
        yield f"event: error\ndata: {json.dumps({'message': 'O copiloto está indisponível. Tente novamente.'}, ensure_ascii=False)}\n\n"


@app.get("/v1/health")
async def health():
    return {"status": "ok", "service": "ritmo-ai"}


@app.get("/v1/models/status")
async def model_status(_: Identity = Depends(identity)):
    try:
        async with httpx.AsyncClient(timeout=4) as client:
            result = await client.get(f"{settings.ollama_base_url}/api/tags")
            result.raise_for_status()
        return {
            "available": True,
            "main_model": settings.ollama_main_model,
            "light_model": settings.ollama_light_model,
        }
    except httpx.HTTPError:
        return {"available": False, "main_model": settings.ollama_main_model}


@app.post("/v1/chat/stream")
async def chat(request: ChatRequest, user: Identity = Depends(identity)):
    conversation = admin.table("conversations").select("id").eq(
        "id", request.conversation_id
    ).eq("user_id", user.user_id).maybe_single().execute()
    if not conversation.data:
        raise HTTPException(404, "Conversa não encontrada")
    admin.table("messages").insert({
        "user_id": user.user_id,
        "conversation_id": request.conversation_id,
        "role": "user",
        "content": request.message,
        "status": "completed",
    }).execute()
    history = admin.table("messages").select("role,content").eq(
        "conversation_id", request.conversation_id
    ).eq("user_id", user.user_id).order("created_at", desc=True).limit(20).execute()
    previous_messages = list(reversed(history.data or []))
    context = await compact_context(user.user_id)
    system = (
        "Você é o copiloto Ritmo, especialista brasileiro em conteúdo para TikTok e Instagram. "
        "Seja prático, acolhedor e honesto; nunca prometa viralização. Sugira mudanças, "
        "mas nunca afirme que as aplicou. Quando usar uma memória, cite seu id. "
        f"Contexto autorizado e compacto do criador: {context}"
    )
    return StreamingResponse(
        ollama_stream(
            [{"role": "system", "content": system}, *previous_messages],
            user.user_id,
            request.conversation_id,
        ),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def enqueue(
    kind: str, request: JobRequest, user: Identity, idempotency_key: str | None
):
    hour_start = time.strftime("%Y-%m-%dT%H:00:00Z", time.gmtime())
    recent = admin.table("ai_jobs").select("id", count="exact").eq(
        "user_id", user.user_id
    ).gte("created_at", hour_start).execute()
    if (recent.count or 0) >= settings.hourly_job_limit:
        raise HTTPException(429, "Cota horária de IA atingida. Tente novamente mais tarde.")
    key = idempotency_key or f"{kind}:{user.user_id}:{time.time_ns()}"
    record = {
        "user_id": user.user_id,
        "kind": kind,
        "payload": request.payload,
        "idempotency_key": key,
        "status": "queued",
    }
    result = admin.table("ai_jobs").upsert(
        record,
        on_conflict="user_id,idempotency_key",
        ignore_duplicates=True,
    ).execute()
    if not result.data:
        result = admin.table("ai_jobs").select("*").eq(
            "user_id", user.user_id
        ).eq("idempotency_key", key).single().execute()
    return {"job": result.data[0] if isinstance(result.data, list) else result.data}


def job_endpoint(path: str, kind: str):
    async def endpoint(
        request: JobRequest,
        user: Identity = Depends(identity),
        idempotency_key: str | None = Header(None),
    ):
        return await enqueue(kind, request, user, idempotency_key)
    app.post(path)(endpoint)


job_endpoint("/v1/plans/generate", "plan.generate")
job_endpoint("/v1/plans/revise", "plan.revise")
job_endpoint("/v1/content/generate", "content.generate")
job_endpoint("/v1/content/revise", "content.revise")
job_endpoint("/v1/trends/research", "trends.research")
job_endpoint("/v1/memories/extract", "memories.extract")
job_endpoint("/v1/conversations/summarize", "conversations.summarize")


@app.get("/v1/jobs/{job_id}")
async def get_job(job_id: str, user: Identity = Depends(identity)):
    result = admin.table("ai_jobs").select(
        "id,kind,status,progress,result,error_code,created_at,updated_at"
    ).eq("id", job_id).eq("user_id", user.user_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(404, "Trabalho não encontrado")
    return result.data


@app.post("/v1/jobs/{job_id}/cancel")
async def cancel_job(job_id: str, user: Identity = Depends(identity)):
    result = admin.table("ai_jobs").update({"status": "cancelled"}).eq(
        "id", job_id
    ).eq("user_id", user.user_id).in_(
        "status", ["queued", "waiting_retry", "running"]
    ).execute()
    return {"cancelled": bool(result.data)}
