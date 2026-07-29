import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const cssFiles = ["app/globals.css", "app/product.css", "app/week-page.css", "app/data-page.css"];

async function styles() {
  return (await Promise.all(cssFiles.map((file) => readFile(file, "utf8")))).join("\n");
}

test("mantém texto funcional acima do piso de legibilidade", async () => {
  const css = await styles();
  const explicitSizes = [...css.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]));
  const shorthandSizes = [...css.matchAll(/font:\s*[^;{}]*?\s(\d+(?:\.\d+)?)px(?:\/[^\s;{}]+)?/g)].map((match) => Number(match[1]));
  const undersized = [...explicitSizes, ...shorthandSizes].filter((size) => size < 12);
  assert.deepEqual(undersized, []);
});

test("protege campos e layouts críticos no mobile", async () => {
  const product = await readFile("app/product.css", "utf8");
  const global = await readFile("app/globals.css", "utf8");
  assert.match(product, /font-size:16px;line-height:1\.4/);
  assert.match(product, /min-height:100dvh/);
  assert.match(product, /\.metric-grid,\.profile-grid\{grid-template-columns:1fr\}/);
  assert.match(global, /button,input,select,textarea\{min-height:44px\}/);
  assert.match(global, /:focus-visible\{outline:3px/);
});
