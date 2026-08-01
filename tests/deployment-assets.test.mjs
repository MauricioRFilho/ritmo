import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function filesBelow(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const path = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, directory);
    return entry.isDirectory() ? filesBelow(path) : [path];
  }))).flat();
}

test("artefato publicado não contém recursos locais", async () => {
  const dist = new URL("../dist/", import.meta.url);
  const files = await filesBelow(dist);
  const searchable = files.filter((file) => /\.(?:html|css|js|json)$/.test(file.pathname));
  const contents = await Promise.all(searchable.map((file) => readFile(file, "utf8")));
  const bundle = contents.join("\n");

  assert.doesNotMatch(bundle, /file:\/\/\//i);
  assert.doesNotMatch(bundle, /[.]vinext\/fonts/i);
  assert.doesNotMatch(bundle, /http:\/\/localhost:8000/i);
  assert.match(bundle, /https:\/\/ritmo-api[.]gapet[.]com[.]br/);
});


test("imagem Docker inclui o catálogo oficial no layout de runtime", async () => {
  const dockerfile = await readFile(new URL("../services/ai-gateway/Dockerfile", import.meta.url), "utf8");
  const compose = await readFile(new URL("../docker-compose.yml", import.meta.url), "utf8");
  assert.match(dockerfile, /COPY modelos \.\/modelos/);
  assert.match(dockerfile, /COPY services\/ai-gateway\/app \.\/app/);
  assert.match(compose, /context: \./);
  assert.match(compose, /dockerfile: services\/ai-gateway\/Dockerfile/);
});
