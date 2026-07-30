import json
import unittest

import httpx

from app.supabase_rpc import start_template_adaptation


class SupabaseRpcTests(unittest.IsolatedAsyncioTestCase):
    async def test_official_template_uses_unified_start_without_community_post(self):
        async def handler(request):
            body = json.loads(request.content)
            self.assertIsNone(body["p_community_post_id"])
            self.assertEqual(body["p_template_version"], 2)
            self.assertEqual(body["p_adaptation_brief"], "Adapte ao contexto oficial")
            return httpx.Response(200, json={"ai_job_id": "job-id"})
        result = await start_template_adaptation(
            supabase_url="https://example.supabase.co", publishable_key="publishable",
            user_token="user-jwt", community_post_id=None, template_id="template-id",
            template_version=2, adaptation_brief="Adapte ao contexto oficial",
            idempotency_key="adaptation-key-1",
            transport=httpx.MockTransport(handler),
        )
        self.assertEqual(result["ai_job_id"], "job-id")

    async def test_community_rpc_uses_user_bearer_and_returns_provenance(self):
        async def handler(request):
            self.assertEqual(request.headers["authorization"], "Bearer user-jwt")
            self.assertEqual(request.headers["apikey"], "publishable")
            self.assertNotIn("service_role", request.headers["authorization"])
            self.assertTrue(str(request.url).endswith("/rest/v1/rpc/start_template_adaptation"))
            self.assertEqual(json.loads(request.content), {"p_template_id": "template-id", "p_template_version": 3, "p_community_post_id": "post-id", "p_adaptation_brief": "Adapte ao público corredor", "p_idempotency_key": "adaptation-key-1"})
            return httpx.Response(200, json={"content_plan_id": "plan-id", "provenance_id": "provenance-id"})
        result = await start_template_adaptation(
            supabase_url="https://example.supabase.co/", publishable_key="publishable",
            user_token="user-jwt", community_post_id="post-id", template_id="template-id",
            template_version=3, adaptation_brief="Adapte ao público corredor",
            idempotency_key="adaptation-key-1",
            transport=httpx.MockTransport(handler),
        )
        self.assertEqual(result["content_plan_id"], "plan-id")
        self.assertEqual(result["provenance_id"], "provenance-id")


if __name__ == "__main__":
    unittest.main()
