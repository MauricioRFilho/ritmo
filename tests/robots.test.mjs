import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("robots publica sitemap e protege rotas privadas", async () => {
  const robots = await readFile(new URL("../app/robots.ts", import.meta.url), "utf8");
  assert.match(robots, /sitemap\.xml/);
  assert.match(robots, /\/admin\//);
  assert.match(robots, /\/blog/);
});
