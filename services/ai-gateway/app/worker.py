import asyncio
import json
import os
import socket
from datetime import datetime, timedelta, timezone

import httpx
from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
OLLAMA_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
MODEL = os.getenv("OLLAMA_MAIN_MODEL", "qwen3:8b")
db = create_client(SUPABASE_URL, SERVICE_KEY)
worker_name = f"{socket.gethostname()}:{os.getpid()}"


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
    return f"{instructions.get(job['kind'], 'Ajude o criador.')}\nDADOS:\n{json.dumps(job['payload'], ensure_ascii=False)}\nResponda em JSON válido."


async def run_job(job: dict):
    started = datetime.now(timezone.utc)
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            response = await client.post(f"{OLLAMA_URL}/api/generate", json={"model": MODEL, "prompt": prompt_for(job), "stream": False, "format": "json"})
            response.raise_for_status()
            raw = response.json().get("response", "{}")
        result = json.loads(raw)
        db.table("ai_jobs").update({"status": "completed", "progress": 100, "result": result, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", job["id"]).execute()
        db.table("ai_usage_events").insert({
            "user_id": job["user_id"], "job_id": job["id"], "model": MODEL, "operation": job["kind"],
            "duration_ms": int((datetime.now(timezone.utc) - started).total_seconds() * 1000), "success": True
        }).execute()
    except Exception:
        retry = job["attempts"] < job["max_attempts"]
        update = {
            "status": "waiting_retry" if retry else "failed",
            "error_code": "generation_failed",
            "run_after": (datetime.now(timezone.utc) + timedelta(seconds=min(300, 15 * 2 ** job["attempts"]))).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        db.table("ai_jobs").update(update).eq("id", job["id"]).execute()


async def main():
    while True:
        claimed = db.rpc("claim_ai_job", {"worker_name": worker_name}).execute()
        if claimed.data:
            await run_job(claimed.data[0])
        else:
            await asyncio.sleep(2)


if __name__ == "__main__":
    asyncio.run(main())
