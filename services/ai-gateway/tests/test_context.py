import os
import unittest
from unittest.mock import AsyncMock, patch

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "publishable-test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")

from app.main import AdaptRequest, Identity, adapt_content, normalize_creator_context


class ContextNormalizationTests(unittest.TestCase):
    def test_normalizes_v2_sections_without_mixing_style_and_monetization(self):
        result = normalize_creator_context(
            {"display_name": "Maurício", "account_mode": "professional", "context": {
                "audience": {"description": "Corredores iniciantes"},
                "style": "Humor seco e linguagem direta",
                "monetization": "Afiliados e venda de consultoria",
                "objectives": {"result": "Gerar demanda"},
                "operation": {"frequency": "3 vezes por semana"},
                "restrictions": ["Não prometer resultados"],
            }},
            [{"category": "content_taxonomy", "niche_id": "corrida", "value": {
                "schema_version": 2,
                "primary_niche_id": "corrida",
                "secondary_niche_ids": ["fitness", "corrida", "fitness", None],
                "custom_niches": ["trail running", "trail running", " "],
            }}],
            [{"id": "memory-1", "content": "Prefere vídeos curtos"}],
        )
        self.assertEqual(result["nichos"]["principal"], "corrida")
        self.assertEqual(result["nichos"]["secundarios"], ["fitness"])
        self.assertEqual(result["nichos"]["personalizados"], ["trail running"])
        self.assertEqual(result["estilo"], "Humor seco e linguagem direta")
        self.assertEqual(result["monetizacao"], "Afiliados e venda de consultoria")
        self.assertNotIn(result["estilo"], result["nichos"].values())
        self.assertNotIn(result["monetizacao"], result["nichos"].values())

    def test_reads_legacy_niche_without_mutating_it(self):
        legacy = {"niche_id": "culinaria"}
        result = normalize_creator_context(
            {"context": {"weekly_hours": 4}},
            [{"category": "content_taxonomy", "niche_id": "culinaria", "value": legacy}],
            [],
        )
        self.assertEqual(result["nichos"], {"schema_version": 2, "principal": "culinaria", "secundarios": [], "personalizados": []})
        self.assertEqual(result["operacao"]["weekly_hours"], 4)
        self.assertEqual(legacy, {"niche_id": "culinaria"})

    def test_non_taxonomy_preferences_never_become_niches(self):
        result = normalize_creator_context(
            {"context": {"estilo": "Educativo", "monetizacao": "Produtos digitais", "publico": "Pequenos negócios", "objetivos": "Vender", "restricoes": "Sem sensacionalismo"}},
            [
                {"category": "style", "niche_id": "humor", "value": {"niche_id": "humor"}},
                {"category": "monetization", "niche_id": "afiliado", "value": {"niche_id": "afiliado"}},
            ],
            None,
        )
        self.assertIsNone(result["nichos"]["principal"])
        self.assertEqual(result["estilo"], "Educativo")
        self.assertEqual(result["monetizacao"], "Produtos digitais")
        self.assertEqual(result["publico"], "Pequenos negócios")
        self.assertEqual(result["objetivos"], "Vender")
        self.assertEqual(result["restricoes"], "Sem sensacionalismo")

    def test_preserves_free_form_operation_and_structured_fields(self):
        result = normalize_creator_context(
            {"context": {
                "operation": "Produzo sozinho à noite",
                "weekly_hours": 6,
                "platforms": ["instagram", "tiktok"],
                "publishing_frequency": "4 vezes por semana",
                "resources": "Celular, tripé e ring light",
            }},
            [],
            [],
        )
        self.assertEqual(result["operacao"], {
            "descricao": "Produzo sozinho à noite",
            "weekly_hours": 6,
            "platforms": ["instagram", "tiktok"],
            "publishing_frequency": "4 vezes por semana",
            "resources": "Celular, tripé e ring light",
        })


class AdaptationContextTests(unittest.IsolatedAsyncioTestCase):
    async def test_adaptation_requires_server_authorized_context_in_atomic_job(self):
        authorized = {"nichos": {"principal": "corrida"}, "publico": "iniciantes", "estilo": "direto", "monetizacao": "afiliados", "objetivos": "educar", "restricoes": ["sem promessas"]}
        class Query:
            def __init__(self, data): self.data = data
            def select(self, *args): return self
            def eq(self, *args): return self
            def single(self): return self
            def maybe_single(self): return self
            def execute(self): return self
        class Admin:
            def table(self, name):
                if name == "public_template_catalog": return Query({"id": "00000000-0000-0000-0000-000000000001", "version": 1})
                return Query({"id": "job-id", "kind": "content.adapt", "payload": {"authorized_creator_context": authorized}})
        request = AdaptRequest(template_id="00000000-0000-0000-0000-000000000001", template_version=1, adaptation_brief="Adapte ao contexto autorizado", payload={})
        user = Identity(user_id="user-id", token="user-token")
        with patch("app.main.start_template_adaptation", AsyncMock(return_value={"ai_job_id": "job-id", "content_plan_id": "plan-id", "provenance_id": "provenance-id"})), patch("app.main.admin", Admin()):
            result = await adapt_content(request, user, "adaptation-key-1")
        self.assertEqual(result["job"]["payload"]["authorized_creator_context"], authorized)
        self.assertEqual(result["job"]["id"], "job-id")


if __name__ == "__main__":
    unittest.main()
