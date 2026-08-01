from __future__ import annotations

from typing import Any

import httpx


async def start_template_adaptation(
    *,
    supabase_url: str,
    publishable_key: str,
    user_token: str,
    community_post_id: str | None,
    template_id: str,
    template_version: int,
    adaptation_brief: str,
    idempotency_key: str,
    transport: httpx.AsyncBaseTransport | None = None,
) -> dict[str, Any] | None:
    """Call the SECURITY DEFINER RPC as the authenticated creator, never service_role."""
    headers = {
        "apikey": publishable_key,
        "authorization": f"Bearer {user_token}",
        "content-type": "application/json",
    }
    async with httpx.AsyncClient(timeout=15, transport=transport) as client:
        response = await client.post(
            f"{supabase_url.rstrip('/')}/rest/v1/rpc/start_template_adaptation",
            headers=headers,
            json={
                "p_template_id": template_id,
                "p_template_version": template_version,
                "p_community_post_id": community_post_id,
                "p_adaptation_brief": adaptation_brief,
                "p_idempotency_key": idempotency_key,
            },
        )
        response.raise_for_status()
        value = response.json()
    if not isinstance(value, dict):
        raise ValueError("invalid community adaptation response")
    return value
