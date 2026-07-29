import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/ritmo-dashboard.tsx", import.meta.url);
const schemaPath = new URL("../services/ai-gateway/app/schemas.py", import.meta.url);
const workerPath = new URL("../services/ai-gateway/app/worker.py", import.meta.url);

test("frontend bloqueia roteiros genéricos ou longos antes da revisão", async () => {
  const source = await readFile(dashboardPath, "utf8");
  assert.match(source, /assertUsefulContentPackage\(job\.result, plan\.format\)/);
  assert.match(source, /duration > maximum/);
  assert.match(source, /genericScriptTerms/);
  assert.match(source, /Duração estimada · máximo \{durationLimit\}s/);
  assert.match(source, /assertUsefulContentPackage\(edited, selectedPlan\.format\)/);
});

test("worker exige roteiro específico de vídeo curto", async () => {
  const [schema, worker] = await Promise.all([readFile(schemaPath, "utf8"), readFile(workerPath, "utf8")]);
  assert.match(schema, /roteiro deve durar entre 15 e/);
  assert.match(schema, /cenas duplicadas/);
  assert.match(schema, /texto genérico ou curto demais/);
  assert.match(worker, /jamais ultrapasse 60 segundos/);
  assert.match(worker, /exatamente 3 opções de gancho/);
});
