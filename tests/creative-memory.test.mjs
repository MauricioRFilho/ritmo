import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/ritmo-dashboard.tsx", import.meta.url);
const gatewayPath = new URL("../services/ai-gateway/app/main.py", import.meta.url);
const workerPath = new URL("../services/ai-gateway/app/worker.py", import.meta.url);
const migrationPath = new URL("../supabase/migrations/202607290001_creative_approval_memory.sql", import.meta.url);

test("aprovação cria versão e sugestão de memória atomicamente", async () => {
  const [dashboard, migration] = await Promise.all([readFile(dashboardPath, "utf8"), readFile(migrationPath, "utf8")]);
  assert.match(dashboard, /rpc\("approve_content_version"/);
  assert.match(dashboard, /remember_patterns/);
  assert.match(migration, /insert into public\.content_versions/);
  assert.match(migration, /'memories\.extract'/);
  assert.match(migration, /'content_version'/);
  assert.match(migration, /security definer/);
});

test("somente memórias aprovadas alimentam novas gerações", async () => {
  const [gateway, worker] = await Promise.all([readFile(gatewayPath, "utf8"), readFile(workerPath, "utf8")]);
  assert.match(gateway, /"status", \["confirmed", "pinned"\]/);
  assert.match(gateway, /approved_creator_memories/);
  assert.match(worker, /creative_library_context/);
  assert.match(worker, /não copie texto literal/);
  assert.match(worker, /source_type = payload\.get\("source_type"/);
});
