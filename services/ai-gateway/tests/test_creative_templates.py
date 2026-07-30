import json
import unittest
from pathlib import Path

from pydantic import ValidationError

from app.creative_templates import TEMPLATE_GUIDANCE, TemplateSelection, approved_template_summary, creative_library_context, load_approved_template, normalize_legacy_template, require_template_reference, select_template, sync_official_templates

ROOT = Path(__file__).resolve().parents[3]


class CreativeTemplateTests(unittest.TestCase):
    def test_adaptation_contract_requires_brief_and_positive_version(self):
        with self.assertRaises(ValidationError):
            TemplateSelection.model_validate({"template_id": "official-template", "template_version": 1})
        with self.assertRaises(ValidationError):
            TemplateSelection.model_validate({"template_id": "official-template", "template_version": 0, "adaptation_brief": "Adapte para meu público"})
        request = TemplateSelection.model_validate({"template_id": "official-template", "template_version": 2, "adaptation_brief": "Adapte para meu público"})
        self.assertEqual(request.template_version, 2)

    def test_runtime_reference_requires_uuid_and_exact_version(self):
        with self.assertRaises(ValueError):
            require_template_reference({"template_id": "not-a-uuid", "template_version": 1})
        with self.assertRaises(ValueError):
            require_template_reference({"template_id": "00000000-0000-0000-0000-000000000001"})
        self.assertEqual(require_template_reference({"template_id": "00000000-0000-0000-0000-000000000001", "template_version": 3}), ("00000000-0000-0000-0000-000000000001", 3))
    def test_catalog_has_24_approved_templates_across_8_types(self):
        templates = approved_template_summary()
        self.assertEqual(len(templates), 24)
        self.assertEqual({item["creative_type"] for item in templates}, set(TEMPLATE_GUIDANCE))

    def test_template_id_loads_canonical_spec_with_provenance(self):
        spec = load_approved_template("short-video-v1")
        self.assertEqual(spec["provenance"]["template_id"], "short-video-v1")
        self.assertEqual(spec["provenance"]["catalog"], "ritmo-seed-creatives")

    def test_runtime_context_requires_server_approved_spec(self):
        with self.assertRaises(ValueError):
            creative_library_context({"template_id": "00000000-0000-0000-0000-000000000001"})
        spec = load_approved_template("short-video-v1")
        context = creative_library_context({"template_id": "00000000-0000-0000-0000-000000000001", "approved_template": spec})
        self.assertIn("Não copie", context)
        community = creative_library_context({"template_id": "00000000-0000-0000-0000-000000000002", "creative_type": "short_video", "approved_template": {"hooks": ["estrutura"]}, "template_provenance": {"origin": "community"}})
        self.assertIn('"origin": "community"', community)

    def test_sync_uses_idempotent_catalog_key(self):
        class Query:
            def __init__(self, data=None): self.rows = None; self.data = data or []
            def select(self, *args): return self
            def eq(self, *args): return self
            def insert(self, rows): self.rows = rows; return self
            def execute(self): return self
        class Client:
            def __init__(self): self.query = Query(); self.name = None
            def table(self, name): self.name = name; return self.query
        client = Client()
        self.assertEqual(sync_official_templates(client), 24)
        self.assertEqual(client.name, "creative_template_catalog")
        self.assertTrue(all(row["origin"] == "official" for row in client.query.rows))

    def test_sync_rejects_mutation_of_published_official_version(self):
        class Query:
            def __init__(self): self.data = [{"template_key": "short-video-v1", "version": 1, "template_json": {"changed": True}}]
            def select(self, *args): return self
            def eq(self, *args): return self
            def execute(self): return self
        class Client:
            def __init__(self): self.query = Query()
            def table(self, name): return self.query
        with self.assertRaisesRegex(ValueError, "imutável divergiu"):
            sync_official_templates(Client())
    def test_all_seed_models_normalize_without_losing_payload(self):
        library = json.loads((ROOT / "modelos" / "library.json").read_text(encoding="utf-8-sig"))
        for filename in [item["source"] for item in library["templates"]]:
            with self.subTest(filename=filename):
                legacy = json.loads((ROOT / "modelos" / filename).read_text(encoding="utf-8-sig"))
                normalized = normalize_legacy_template(legacy)
                self.assertEqual(normalized["schema_version"], 1)
                self.assertIn(normalized["creative_type"], TEMPLATE_GUIDANCE)
                if legacy.get("schema_version") != 1:
                    self.assertEqual(normalized["creative"], legacy)
                self.assertEqual(normalized["provenance"]["origin"], "seed")

    def test_format_selects_matching_reference(self):
        self.assertEqual(select_template({"format": "carousel"}), "instagram_carousel")
        self.assertEqual(select_template({"format": "reel"}), "short_video")
        self.assertIn('"hook"', creative_library_context({"format": "reel"}))

    def test_explicit_template_wins(self):
        self.assertEqual(select_template({"format": "reel", "creative_type": "ugc_ad"}), "ugc_ad")

    def test_unknown_legacy_type_is_rejected(self):
        with self.assertRaises(ValueError):
            normalize_legacy_template({"creator_type": "unknown"})


if __name__ == "__main__":
    unittest.main()
