import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/ritmo-dashboard.tsx", import.meta.url);
const schemaPath = new URL("../services/ai-gateway/app/schemas.py", import.meta.url);
const workerPath = new URL("../services/ai-gateway/app/worker.py", import.meta.url);

test("frontend exige três ideias completas e selecionáveis antes da revisão", async () => {
  const source = await readFile(dashboardPath, "utf8");
  assert.match(source, /assertUsefulContentPackage\(job\.result, plan\.format\)/);
  assert.match(source, /duration > maximum/);
  assert.match(source, /genericScriptTerms/);
  assert.match(source, /Duração estimada · máximo \{durationLimit\}s/);
  assert.match(source, /assertUsefulContentPackage\(edited, selectedPlan\.format\)/);
  assert.match(source, /3 IDEIAS COMPLETAS/);
  assert.match(source, /selected_idea_index/);
  assert.match(source, /NARRAÇÃO/);
});

test("worker exige serviço editorial completo de vídeo curto", async () => {
  const [schema, worker] = await Promise.all([readFile(schemaPath, "utf8"), readFile(workerPath, "utf8")]);
  assert.match(schema, /roteiro deve durar entre 15 e/);
  assert.match(schema, /cenas duplicadas/);
  assert.match(schema, /texto genérico ou curto demais/);
  assert.match(worker, /jamais ultrapasse 60 segundos/);
  assert.match(worker, /exatamente 3 ideias realmente diferentes/);
  assert.match(worker, /recommended_idea_index/);
  assert.match(schema, /class CreatorServicePackage/);
  assert.match(schema, /class CreativeIdea/);
});
