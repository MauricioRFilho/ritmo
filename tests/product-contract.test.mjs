import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/ritmo-dashboard.tsx", import.meta.url);
const gatewayPath = new URL("../services/ai-gateway/app/main.py", import.meta.url);
const workerPath = new URL("../services/ai-gateway/app/worker.py", import.meta.url);

test("vertical slice persiste onboarding, ideia, versão e agendamento", async () => {
  const source = await readFile(dashboardPath, "utf8");
  for (const contract of [
    'from("profiles").update',
    'from("creator_preferences").upsert',
    'from("content_plans").insert',
    "/v1/content/generate",
    'approve_content_version',
    'p_scheduled_for',
  ]) assert.ok(source.includes(contract), `contrato ausente: ${contract}`);
});

test("copiloto usa streaming e histórico persistente", async () => {
  const frontend = await readFile(dashboardPath, "utf8");
  const gateway = await readFile(gatewayPath, "utf8");
  assert.match(frontend, /\/v1\/chat\/stream/);
  assert.match(frontend, /response\.body\.getReader/);
  assert.match(gateway, /role": "assistant"/);
  assert.match(gateway, /previous_messages/);
});

test("worker valida schemas e recupera jobs abandonados", async () => {
  const worker = await readFile(workerPath, "utf8");
  assert.match(worker, /validate_result/);
  assert.match(worker, /ollama_schema_for/);
  assert.match(worker, /requeue_stale_ai_jobs/);
  assert.match(worker, /record_usage\(job, model, started, False\)/);
});

test("dashboard não contém a agenda fictícia original", async () => {
  const source = await readFile(dashboardPath, "utf8");
  assert.doesNotMatch(source, /3 erros que atrasam seu negócio|18,4 mil|Maurício/);
});
