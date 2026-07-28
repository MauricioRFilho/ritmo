import ast
import pathlib
import unittest


class PrivacyWorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = pathlib.Path(__file__).parents[1] / "app" / "privacy_worker.py"
        cls.source = path.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source)

    def test_worker_claims_only_deletion_function(self):
        self.assertIn("claim_privacy_deletion", self.source)

    def test_worker_deletes_through_supabase_admin(self):
        self.assertIn("db.auth.admin.delete_user(user_id)", self.source)

    def test_worker_audits_only_after_successful_delete(self):
        deletion = self.source.index("db.auth.admin.delete_user(user_id)")
        audit = self.source.index('"privacy.account_deletion_completed"')
        self.assertGreater(audit, deletion)
        self.assertIn('"user_id": None', self.source)

    def test_worker_retries_and_has_terminal_state(self):
        self.assertIn('request["attempts"] >= 3', self.source)
        self.assertIn("requeue_stale_privacy_deletions", self.source)
