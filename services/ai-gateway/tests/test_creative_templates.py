import json
import unittest
from pathlib import Path

from app.creative_templates import TEMPLATE_GUIDANCE, creative_library_context, normalize_legacy_template, select_template

ROOT = Path(__file__).resolve().parents[3]


class CreativeTemplateTests(unittest.TestCase):
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
