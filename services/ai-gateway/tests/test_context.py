import os
import unittest

os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "publishable-test")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")

from app.main import normalize_creator_context


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


if __name__ == "__main__":
    unittest.main()
