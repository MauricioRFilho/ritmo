import json
import unittest

from pydantic import ValidationError

from app.schemas import json_schema_for, ollama_schema_for, validate_result


class SchemaTests(unittest.TestCase):
    def test_ollama_schema_removes_large_string_bounds(self):
        serialized = json.dumps(ollama_schema_for("content.generate"))
        self.assertNotIn("maxLength", serialized)
        self.assertIn("maxItems", serialized)

    def test_content_package_accepts_a_complete_result(self):
        result = validate_result("content.generate", {
            "objective": "Ensinar um conceito",
            "hooks": ["Você comete este erro?", "Sua recuperação pode melhorar hoje", "Pare de ignorar este sinal"],
            "scenes": [{
                "order": 1,
                "visual": "Criador em plano médio aponta para a panturrilha",
                "speech": "Sua panturrilha segue dolorida depois do treino?",
                "duration_seconds": 8,
            }, {
                "order": 2,
                "visual": "Criador demonstra mobilidade leve junto à parede",
                "speech": "Faça este movimento devagar e pare se houver dor aguda.",
                "duration_seconds": 10,
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


    def test_content_package_rejects_long_short_video(self):
        with self.assertRaises(ValidationError):
            validate_result("content.generate", {
                "objective": "Ensinar recuperação após o treino",
                "hooks": ["Gancho específico número um", "Gancho específico número dois", "Gancho específico número três"],
                "scenes": [{"order": index, "visual": f"Demonstração detalhada número {index}", "speech": f"Fala completa e útil para a cena número {index}", "duration_seconds": 20} for index in range(1, 5)],
                "caption": "Uma legenda completa que acrescenta contexto.",
                "cta": "Salve este roteiro para testar depois.",
            })

    def test_content_package_rejects_placeholders(self):
        with self.assertRaises(ValidationError):
            validate_result("content.generate", {
                "objective": "Ensinar recuperação após o treino",
                "hooks": ["ganchos", "cenas", "falas"],
                "scenes": [
                    {"order": 1, "visual": "captação", "speech": "exercícios", "duration_seconds": 8},
                    {"order": 2, "visual": "edição", "speech": "exercícios", "duration_seconds": 8},
                ],
                "caption": "Legenda completa para acompanhar o vídeo.",
                "cta": "Salve este vídeo para consultar depois.",
            })
    def test_each_accented_placeholder_is_rejected_in_isolation(self):
        for placeholder in ["ganchos", "cenas", "falas", "captação", "edição", "exercícios"]:
            with self.subTest(placeholder=placeholder), self.assertRaises(ValidationError):
                validate_result("content.generate", {
                    "objective": "Ensinar recuperação após o treino",
                    "hooks": [placeholder, "Como aliviar a panturrilha depois do treino", "Um movimento leve para testar hoje"],
                    "scenes": [
                        {"order": 1, "visual": "Criador aponta para a panturrilha dolorida", "speech": "Você treinou e a panturrilha ficou pesada?", "duration_seconds": 8},
                        {"order": 2, "visual": "Criador demonstra mobilidade junto à parede", "speech": "Faça este movimento com calma e sem forçar a dor.", "duration_seconds": 10},
                    ],
                    "caption": "Uma orientação curta para apoiar sua recuperação.",
                    "cta": "Salve para consultar depois do próximo treino.",
                })

    def test_carousel_is_not_rejected_by_video_duration(self):
        result = validate_result("content.generate", {
            "objective": "Ensinar recuperação após o treino",
            "hooks": ["Sua panturrilha ainda pesa?", "Três cuidados depois da corrida", "Recupere melhor sem exagerar"],
            "scenes": [
                {"order": 1, "visual": "Card com título e ilustração da panturrilha", "speech": "Comece observando a intensidade do desconforto.", "duration_seconds": 2},
                {"order": 2, "visual": "Card com demonstração de movimento leve", "speech": "Faça mobilidade sem insistir em dor aguda.", "duration_seconds": 2},
            ],
            "caption": "Uma sequência simples para orientar sua recuperação.",
            "cta": "Salve o carrossel para rever após o treino.",
        }, {"format": "carousel"})
        self.assertEqual(len(result["scenes"]), 2)
if __name__ == "__main__":
    unittest.main()
