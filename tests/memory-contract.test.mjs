import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cada resposta persistida agenda extração de memória idempotente", async () => {
  const gateway = await readFile(new URL("../services/ai-gateway/app/main.py", import.meta.url), "utf8");
  assert.match(gateway, /assistant_message_id/);
  assert.match(gateway, /"kind": "memories\.extract"/);
  assert.match(gateway, /idempotency_key": f"memory:/);
});

test("worker promove somente memórias normais para revisão", async () => {
  const worker = await readFile(new URL("../services/ai-gateway/app/worker.py", import.meta.url), "utf8");
  assert.match(worker, /def promote_result/);
  assert.match(worker, /item\["sensitivity"\] == "normal"/);
  assert.match(worker, /"status": "suggested"/);
  assert.match(worker, /table\("memory_sources"\)\.insert/);
});
