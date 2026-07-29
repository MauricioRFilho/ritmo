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
