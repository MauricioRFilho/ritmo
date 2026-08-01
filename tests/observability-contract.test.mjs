import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("gateway trata ausência de bearer como 401, não erro de validação", async () => {
  const source = await readFile(new URL("../services/ai-gateway/app/main.py", import.meta.url), "utf8");
  assert.match(source, /authorization: str \| None = Header\(None\)/);
  assert.match(source, /if not authorization or not authorization\.startswith/);
});

test("gateway emite correlação sem registrar payload ou token", async () => {
  const source = await readFile(new URL("../services/ai-gateway/app/observability.py", import.meta.url), "utf8");
  assert.match(source, /x-request-id/);
  assert.match(source, /X-Request-ID/);
  assert.match(source, /request_completed/);
  assert.doesNotMatch(source, /authorization|request\.body/);
});

test("worker cancela stream antes de promover resultado", async () => {
  const source = await readFile(new URL("../services/ai-gateway/app/worker.py", import.meta.url), "utf8");
  const cancelCheck = source.indexOf('if is_cancelled(job["id"])');
  const promotion = source.indexOf("promote_result(job, result)");
  assert.ok(cancelCheck >= 0);
  assert.ok(promotion > cancelCheck);
  assert.match(source, /class JobCancelled/);
  assert.match(source, /job_cancelled/);
});

test("worker registra ciclo de vida com job id", async () => {
  const source = await readFile(new URL("../services/ai-gateway/app/worker.py", import.meta.url), "utf8");
  for (const event of ["job_started", "job_completed", "job_failed", "stale_recovery"]) {
    assert.match(source, new RegExp(event));
  }
  assert.match(source, /job_id=job\["id"\]/);
});

test("produção fecha documentação e aplica headers defensivos", async () => {
  const main = await readFile(new URL("../services/ai-gateway/app/main.py", import.meta.url), "utf8");
  const observability = await readFile(new URL("../services/ai-gateway/app/observability.py", import.meta.url), "utf8");
  assert.match(main, /environment\.lower\(\) != "production" and settings\.api_docs_enabled/);
  assert.match(main, /docs_url="\/docs" if docs_enabled else None/);
  for (const header of ["X-Content-Type-Options", "X-Frame-Options", "Content-Security-Policy", "Cache-Control"]) {
    assert.match(observability, new RegExp(header));
  }
});

test("nginx limita requisições e preserva streaming", async () => {
  const nginx = await readFile(new URL("../deploy/nginx/ritmo-api.gapet.com.br.conf", import.meta.url), "utf8");
  assert.match(nginx, /limit_req_zone/);
  assert.match(nginx, /limit_req_status 429/);
  assert.match(nginx, /proxy_buffering off/);
  assert.match(nginx, /proxy_request_buffering off/);
  assert.match(nginx, /proxy_pass http:\/\/127\.0\.0\.1:8000/);
});
