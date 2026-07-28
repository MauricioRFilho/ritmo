import asyncio
import json
import os
import socket
import time
from datetime import datetime, timedelta, timezone

import httpx
from pydantic import ValidationError
from supabase import create_client

from app.observability import get_logger, log_event
from app.schemas import ollama_schema_for, validate_result

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MAIN_MODEL", "qwen3:8b")
LIGHT_MODEL = os.getenv("OLLAMA_LIGHT_MODEL", "qwen3:4b")
db = create_client(SUPABASE_URL, SERVICE_KEY)
worker_name = f"{socket.gethostname()}:{os.getpid()}"
logger = get_logger("ritmo.ai-worker")


class JobCancelled(Exception):
    pass


def prompt_for(job: dict) -> str:
    instructions = {
        "plan.generate": "Crie um plano semanal sustentável, sem conflitos e usando apenas os recursos informados.",
        "plan.revise": "Revise o plano preservando itens bloqueados manualmente.",
        "content.generate": "Crie um pacote completo: objetivo, 3 ganchos, cenas, falas, captação, edição, legenda, CTA, hashtags e horário.",
        "content.revise": "Revise somente os campos pedidos e mantenha as demais decisões.",
        "memories.extract": "Extraia apenas preferências duráveis não sensíveis. Retorne sugestões revisáveis.",
        "conversations.summarize": "Resuma fatos, decisões, preferências e pendências sem inventar.",
        "trends.research": "Interprete as evidências fornecidas; não invente tendências ou fontes.",
    }
    payload = json.dumps(job["payload"], ensure_ascii=False)
    return f"{instructions.get(job['kind'], 'Ajude o criador.')}\nDADOS:\n{payload}\nResponda em JSON válido."


def is_cancelled(job_id: str) -> bool:
    result = db.table("ai_jobs").select("status").eq("id", job_id).single().execute()
    return result.data["status"] == "cancelled"


async def generate(job: dict, model: str) -> dict:
    parts: list[str] = []
    last_check = 0.0
    async with httpx.AsyncClient(timeout=180) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt_for(job),
                "stream": True,
                "format": ollama_schema_for(job["kind"]),
            },
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:
                    item = json.loads(line)
                    parts.append(item.get("response", ""))
                now = time.monotonic()
                if now - last_check >= 1:
                    last_check = now
                    if is_cancelled(job["id"]):
                        raise JobCancelled()
    if is_cancelled(job["id"]):
        raise JobCancelled()
    return validate_result(job["kind"], json.loads("".join(parts) or "{}"))


async def run_job(job: dict):
    started = datetime.now(timezone.utc)
    model = LIGHT_MODEL if job["kind"] in {"memories.extract", "conversations.summarize"} else MODEL
    log_event(
        logger, "ai-worker", "job_started",
        job_id=job["id"], operation=job["kind"],
        attempt=job["attempts"], model=model, worker=worker_name,
    )
    try:
        result = await generate(job, model)
        promote_result(job, result)
        db.table("ai_jobs").update({
            "status": "completed", "progress": 100, "result": result,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job["id"]).eq("status", "running").execute()
        record_usage(job, model, started, True)
        log_event(
            logger, "ai-worker", "job_completed",
            job_id=job["id"], operation=job["kind"], model=model,
            duration_ms=duration_ms(started),
        )
    except JobCancelled:
        record_usage(job, model, started, False)
        log_event(
            logger, "ai-worker", "job_cancelled",
            job_id=job["id"], operation=job["kind"], duration_ms=duration_ms(started),
        )
    except Exception as exc:
        retry = job["attempts"] < job["max_attempts"]
        error_code = "invalid_model_output" if isinstance(
            exc, (json.JSONDecodeError, ValidationError)
        ) else "generation_failed"
        db.table("ai_jobs").update({
            "status": "waiting_retry" if retry else "failed",
            "error_code": error_code,
            "run_after": (
                datetime.now(timezone.utc)
                + timedelta(seconds=min(300, 15 * 2 ** job["attempts"]))
            ).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job["id"]).eq("status", "running").execute()
        record_usage(job, model, started, False)
        log_event(
            logger, "ai-worker", "job_failed",
            job_id=job["id"], operation=job["kind"], error_code=error_code,
            retry=retry, duration_ms=duration_ms(started),
        )


def promote_result(job: dict, result: dict):
    if job["kind"] == "memories.extract":
        rows = [{
            "user_id": job["user_id"],
            "category": item["category"],
            "content": item["content"],
            "status": "suggested",
            "confidence": item["confidence"],
            "sensitivity": item["sensitivity"],
            "source_type": "ai_job",
            "source_id": job["id"],
        } for item in result["suggestions"] if item["sensitivity"] == "normal"]
        if rows:
            created = db.table("creator_memories").insert(rows).execute()
            for memory in created.data or []:
                db.table("memory_sources").insert({
                    "user_id": job["user_id"],
                    "memory_id": memory["id"],
                    "source_type": "ai_job",
                    "source_id": job["id"],
                    "excerpt": job["payload"].get("excerpt", "")[:1000],
                }).execute()
    elif job["kind"] == "conversations.summarize":
        payload = job["payload"]
        db.table("conversation_summaries").insert({
            "user_id": job["user_id"],
            "conversation_id": payload["conversation_id"],
            "period_start": payload["period_start"],
            "period_end": payload["period_end"],
            "summary": result["summary"],
        }).execute()


def duration_ms(started: datetime) -> int:
    return int((datetime.now(timezone.utc) - started).total_seconds() * 1000)


def record_usage(job: dict, model: str, started: datetime, success: bool):
    db.table("ai_usage_events").insert({
        "user_id": job["user_id"], "job_id": job["id"], "model": model,
        "operation": job["kind"], "duration_ms": duration_ms(started),
        "success": success,
    }).execute()


async def main():
    recovery_ticks = 0
    log_event(logger, "ai-worker", "worker_started", worker=worker_name)
    while True:
        recovery_ticks += 1
        if recovery_ticks >= 30:
            recovered = db.rpc(
                "requeue_stale_ai_jobs", {"stale_after": "10 minutes"}
            ).execute()
            log_event(
                logger, "ai-worker", "stale_recovery",
                recovered=recovered.data or 0, worker=worker_name,
            )
            recovery_ticks = 0
        claimed = db.rpc("claim_ai_job", {"worker_name": worker_name}).execute()
        if claimed.data:
            await run_job(claimed.data[0])
        else:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
