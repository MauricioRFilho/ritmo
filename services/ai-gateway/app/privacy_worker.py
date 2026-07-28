import asyncio
import json
import logging
import os
import socket

from supabase import create_client

SUPABASE_URL = os.environ["SUPABASE_URL"]
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
POLL_SECONDS = float(os.getenv("PRIVACY_POLL_SECONDS", "5"))
db = create_client(SUPABASE_URL, SERVICE_KEY)
worker_name = f"{socket.gethostname()}:{os.getpid()}"

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(message)s")
logger = logging.getLogger("ritmo.privacy")


def log(event: str, **fields):
    logger.info(json.dumps({
        "service": "privacy-worker",
        "event": event,
        "worker": worker_name,
        **fields,
    }, ensure_ascii=False))


async def process_request(request: dict):
    request_id = request["id"]
    user_id = request["user_id"]
    try:
        db.auth.admin.delete_user(user_id)
        db.table("audit_events").insert({
            "user_id": None,
            "action": "privacy.account_deletion_completed",
            "entity_type": "privacy_request",
            "entity_id": request_id,
            "metadata": {"request_id": request_id},
        }).execute()
        log("deletion_completed", request_id=request_id)
    except Exception:
        terminal = request["attempts"] >= 3
        db.table("privacy_requests").update({
            "status": "rejected" if terminal else "requested",
            "locked_at": None,
            "locked_by": None,
            "notes": "deletion_failed",
        }).eq("id", request_id).execute()
        log("deletion_failed", request_id=request_id, terminal=terminal)


async def main():
    recovery_ticks = 0
    log("worker_started")
    while True:
        recovery_ticks += 1
        if recovery_ticks >= 60:
            recovered = db.rpc(
                "requeue_stale_privacy_deletions",
                {"stale_after": "15 minutes"},
            ).execute()
            log("stale_recovery", recovered=recovered.data or 0)
            recovery_ticks = 0
        claimed = db.rpc(
            "claim_privacy_deletion",
            {"worker_name": worker_name},
        ).execute()
        if claimed.data:
            await process_request(claimed.data[0])
        else:
            await asyncio.sleep(POLL_SECONDS)


if __name__ == "__main__":
    asyncio.run(main())
