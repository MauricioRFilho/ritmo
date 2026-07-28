import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("protege o planejador semanal antes da renderização", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-semana`);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost/semana", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.pathname, "/login");
  assert.equal(location.searchParams.get("return_to"), "/semana");
});

test("plano semanal só aplica conteúdos após confirmação", async () => {
  const source = await readFile(new URL("../app/semana/week-planner.tsx", import.meta.url), "utf8");
  assert.match(source, /\/v1\/plans\/generate/);
  assert.match(source, /from\("weekly_plans"\)\.insert/);
  assert.match(source, /from\("content_plans"\)\.insert/);
  assert.match(source, /status: "confirmed"/);
  assert.match(source, /locked_items: \[\]/);
});
