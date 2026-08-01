import json
import unittest

from pydantic import ValidationError

from app.schemas import json_schema_for, ollama_schema_for, validate_result


def complete_creator_service(scene_duration=6):
    ideas = []
    for idea_index, angle in enumerate(["história pessoal", "ponto de vista", "explicação educativa"], start=1):
        ideas.append({
            "title": f"Ideia completa {idea_index}: {angle}",
            "concept": f"Abordagem de {angle} aplicada ao fato real do briefing.",
            "hook": f"Gancho específico {idea_index} para abrir esta abordagem",
            "scenes": [{
                "order": scene_index,
                "visual": f"Plano filmável {scene_index} da abordagem {idea_index}",
                "speech": f"Fala exata {scene_index} com informação concreta da ideia {idea_index}.",
                "duration_seconds": scene_duration,
            } for scene_index in range(1, 4)],
            "narration": f"Narração completa e natural da ideia {idea_index}, conectando começo, desenvolvimento e resultado.",
            "final_line": f"Encerramento específico e memorável da ideia {idea_index}.",
            "text_overlays": [f"Texto de tela específico {idea_index}"],
            "capture_notes": [f"Capture o plano principal da ideia {idea_index}"],
            "editing_notes": [f"Use cortes coerentes com a ideia {idea_index}"],
        })
    return {
        "objective": "Transformar um fato real em conteúdo útil e publicável",
        "recommended_idea_index": 1,
        "ideas": ideas,
        "caption": "Legenda completa que contextualiza o conteúdo sem repetir todo o roteiro.",
        "cta": "Conte nos comentários qual abordagem você usaria.",
        "hashtags": ["#conteudo", "#criadores", "#roteiro"],
    }


class SchemaTests(unittest.TestCase):
    def test_ollama_schema_removes_large_string_bounds(self):
        serialized = json.dumps(ollama_schema_for("content.generate"))
        self.assertNotIn("maxLength", serialized)
        self.assertIn("maxItems", serialized)

    def test_content_package_accepts_a_complete_result(self):
        result = validate_result("content.generate", complete_creator_service())
        self.assertEqual(len(result["ideas"]), 3)
        self.assertEqual(result["recommended_idea_index"], 1)
        self.assertEqual(result["ideas"][0]["scenes"][0]["order"], 1)

    def test_content_package_rejects_unstructured_output(self):
        with self.assertRaises(ValidationError):
            validate_result("content.generate", {"text": "resposta livre"})

    def test_every_supported_operation_exposes_json_schema(self):
        for kind in [
            "plan.generate", "plan.revise", "content.generate", "content.revise",
            "memories.extract", "conversations.summarize", "trends.research",
        ]:
            self.assertEqual(json_schema_for(kind)["type"], "object")

    def test_adaptation_schema_discriminates_all_creative_types(self):
        schema = json.dumps(json_schema_for("content.adapt"))
        for creative_type in ["advertising_image", "instagram_carousel", "short_video", "tech_educational_video", "ugc_ad", "story_sequence", "live_stream", "newsletter"]:
            self.assertIn(creative_type, schema)

    def test_discriminated_types_require_format_specific_fields(self):
        image = {
            "creative_type": "advertising_image", "objective": "Apresentar um benefício real",
            "headline": "Uma mensagem clara para a peça", "visual_direction": "Produto em uso com um único ponto focal verificável",
            "overlay_text": "Veja como funciona", "caption": "Contexto adicional para a imagem publicada.", "cta": "Conheça todos os detalhes disponíveis."
        }
        self.assertEqual(validate_result("content.adapt", image, {"creative_type": "advertising_image"})["creative_type"], "advertising_image")
        with self.assertRaises(ValidationError):
            validate_result("content.adapt", {**image, "creative_type": "newsletter"}, {"creative_type": "newsletter"})

    def test_canonical_catalog_types_are_exactly_eight(self):
        schema = json.dumps(json_schema_for("content.adapt"))
        canonical = ["advertising_image", "instagram_carousel", "short_video", "tech_educational_video", "ugc_ad", "story_sequence", "live_stream", "newsletter"]
        self.assertEqual(sum(f'"const": "{item}"' in schema for item in canonical), 8)

    def test_adaptation_preserves_server_provenance(self):
        base = {
            "creative_type": "short_video", "objective": "Ensinar um processo útil",
            "hooks": ["Primeiro gancho específico", "Segundo gancho específico", "Terceiro gancho específico"],
            "scenes": [
                {"order": 1, "visual": "Criador apresenta o problema diante da câmera", "speech": "Veja como começar este processo com segurança.", "duration_seconds": 8},
                {"order": 2, "visual": "Criador demonstra uma etapa concreta do processo", "speech": "Agora aplique esta etapa e confira o resultado.", "duration_seconds": 10},
            ], "caption": "Uma explicação prática para acompanhar a demonstração.", "cta": "Salve para aplicar este processo depois."
        }
        provenance = {"template_id": "00000000-0000-0000-0000-000000000001", "template_version": 1}
        result = validate_result("content.adapt", base, {"format": "reel", "creative_type": "short_video", "template_provenance": provenance})
        self.assertEqual(result["template_provenance"], provenance)

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
        result = validate_result("content.generate", complete_creator_service(scene_duration=2), {"format": "carousel"})
        self.assertEqual(len(result["ideas"]), 3)
if __name__ == "__main__":
    unittest.main()
