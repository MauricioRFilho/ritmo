import os
import unittest
from unittest.mock import patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")

from app.worker import promote_result, prompt_for


class WorkerAdaptationTests(unittest.TestCase):
    def test_prompt_includes_authorized_context_and_anti_copy_policy(self):
        prompt = prompt_for({"kind": "content.adapt", "payload": {"format": "reel", "authorized_creator_context": {"estilo": "direto"}}})
        self.assertIn("authorized_creator_context", prompt)
        self.assertIn("não copie", prompt.casefold())

    def test_promotion_delegates_atomic_persistence_to_rpc(self):
        calls = []
        class Query:
            def execute(self): return self
        class Database:
            def rpc(self, name, params): calls.append((name, params)); return Query()
        job = {"id": "00000000-0000-0000-0000-000000000010", "kind": "content.adapt", "payload": {}, "user_id": "user-id"}
        result = {"creative_type": "short_video", "objective": "Objetivo útil"}
        with patch("app.worker.db", Database()):
            promote_result(job, result)
        self.assertEqual(calls, [("complete_community_adaptation", {"p_ai_job_id": job["id"], "p_result": result})])


if __name__ == "__main__":
    unittest.main()
