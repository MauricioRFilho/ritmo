import unittest

from pydantic import ValidationError

from app.schemas import json_schema_for, validate_result


class SchemaTests(unittest.TestCase):
    def test_content_package_accepts_a_complete_result(self):
        result = validate_result("content.generate", {
            "objective": "Ensinar um conceito",
            "hooks": ["Você comete este erro?"],
            "scenes": [{
                "order": 1,
                "visual": "Criador em plano médio",
                "speech": "Vamos corrigir.",
                "duration_seconds": 8,
            }],
            "caption": "Uma legenda útil.",
            "cta": "Salve para rever.",
            "hashtags": ["#conteudo"],
        })
        self.assertEqual(result["scenes"][0]["order"], 1)

    def test_content_package_rejects_unstructured_output(self):
        with self.assertRaises(ValidationError):
            validate_result("content.generate", {"text": "resposta livre"})

    def test_every_supported_operation_exposes_json_schema(self):
        for kind in [
            "plan.generate", "plan.revise", "content.generate", "content.revise",
            "memories.extract", "conversations.summarize", "trends.research",
        ]:
            self.assertEqual(json_schema_for(kind)["type"], "object")

    def test_unknown_operation_is_rejected(self):
        with self.assertRaises(ValueError):
            validate_result("unknown", {})


if __name__ == "__main__":
    unittest.main()
