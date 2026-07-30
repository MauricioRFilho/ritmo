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

test("protege o dashboard antes da renderização", async () => {
  const response = await render();
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get("location")).pathname, "/login");
});

test("renderiza a entrada e o cadastro", async () => {
  const response = await render("/login");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Que bom ter você de volta/);
  assert.match(html, /Criar gratuitamente/);
  assert.match(html, /protegidos na sua conta Ritmo/);
  assert.doesNotMatch(html, /Continuar com Google/);
});
test("falha fechado sem configuração do Supabase", async () => {
  const source = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../lib/supabase-proxy.ts", import.meta.url), "utf8"));
  const configCheck = source.indexOf("if (!url || !key)");
  const protectedCheck = source.indexOf("if (isProtected(pathname))", configCheck);
  const permissiveReturn = source.indexOf("return NextResponse.next({ request })", configCheck);
  assert.ok(configCheck >= 0);
  assert.ok(protectedCheck > configCheck);
  assert.ok(permissiveReturn > protectedCheck);
});
