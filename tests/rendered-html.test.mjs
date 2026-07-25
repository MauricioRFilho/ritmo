import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("renderiza o dashboard do Ritmo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Ritmo — seu copiloto de conteúdo/);
  assert.match(html, /Seu ritmo de hoje/);
  assert.match(html, /Planejar semana/);
  assert.match(html, /Seu copiloto/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
});

test("renderiza a entrada e o cadastro", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Que bom ter você de volta/);
  assert.match(html, /Continuar com Google/);
  assert.match(html, /Criar gratuitamente/);
});
