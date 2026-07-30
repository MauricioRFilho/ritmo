import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile("scripts/promote-community-template.mjs", "utf8");
test("promoção comunitária usa credencial somente no servidor e exige conteúdo aprovado", () => {
  assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /editorial_status.*eq\.approved/s);
  assert.match(source, /active.*eq\.true/s);
  assert.match(source, /worktree limpo/);
});
test("promoção cria branch e PR draft, nunca push direto na main", () => {
  assert.match(source, /candidate\/community-/);
  assert.match(source, /"--draft"/);
  assert.match(source, /"--base", "main"/);
  assert.doesNotMatch(source, /push[^\n]+origin[^\n]+main/);
  assert.match(source, /validate:creative-models/);
  assert.match(source, /schema_version: 1/);
  assert.match(source, /creative_type: template\.creative_type/);
  assert.match(source, /metadata: \{/);
  assert.match(source, /provenance: \{/);
});
test("validador permite crescimento além da biblioteca inicial", async () => {
  const validator = await readFile("scripts/validate-creative-models.mjs", "utf8");
  assert.match(validator, /length \?\? 0\) < 24/);
  assert.doesNotMatch(validator, /length !== 24/);
});
