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
  const undersized = [...explicitSizes, ...shorthandSizes].filter((size) => size > 0 && size < 14);
  assert.deepEqual(undersized, []);
});

test("componentes funcionais críticos respeitam 14px inclusive em shorthand", async () => {
  const product = await readFile("app/product.css", "utf8");
  const readableLayer = product.slice(product.indexOf(".product-shell{--text-body"));
  assert.match(readableLayer, /:where\(p,span,small,label,legend,button,input,select,textarea,dt,dd,time\)\{font-size:max\(14px,1em\)/);
  const sizes = [...readableLayer.matchAll(/font-size:\s*(\d+(?:\.\d+)?)px|font:\s*[^;{}]*?\s(?:var\([^)]*\)|)?(\d+(?:\.\d+)?)px/g)]
    .map((match) => Number(match[1] ?? match[2])).filter(Number.isFinite);
  assert.ok(sizes.every((size) => size >= 14), `camada final contém texto menor que 14px: ${sizes.filter((size) => size < 14)}`);
});

test("protege campos e layouts críticos no mobile", async () => {
  const product = await readFile("app/product.css", "utf8");
  const global = await readFile("app/globals.css", "utf8");
  assert.match(product, /--(?:font|text)[\w-]*body:\s*16px/);
  assert.match(product, /:where\(input,select,textarea\)\{font-size:\s*16px;min-height:\s*52px/);
  assert.match(product, /:where\(button\)\{min-height:\s*48px/);
  assert.match(product, /\.primary-button,.secondary-button\{[^{}]*min-height:\s*48px/);
  assert.match(product, /\.chat-composer button\{[^{}]*width:\s*48px[^{}]*height:\s*48px/);
  assert.match(product, /min-height:100dvh/);
  assert.match(product, /\.metric-grid,\.profile-grid\{grid-template-columns:1fr\}/);
  assert.match(global, /button,input,select,textarea\{min-height:44px\}/);
  assert.match(global, /:focus-visible\{outline:3px/);
});

test("copiloto é legível no desktop e ocupa a viewport móvel", async () => {
  const product = await readFile("app/product.css", "utf8");
  assert.match(product, /\.product-copilot\{[^{}]*width:\s*420px[^{}]*height:\s*620px/);
  assert.match(product, /\.chat-intro strong\{[^{}]*(?:font-size:\s*22px|font:[^;{}]*\s22px)/);
  assert.match(product, /\.chat-message\{[^{}]*font-size:\s*16px[^{}]*line-height:\s*1\.[5-9]/);
  assert.match(product, /\.chat-composer textarea\{[^{}]*font-size:\s*16px/);
  assert.match(product, /@media\(max-width:(?:700|760)px\)[\s\S]*\.product-copilot\{[^{}]*inset:\s*0[^{}]*height:\s*100dvh/);
  assert.match(product, /\.chat-messages\{[^{}]*overflow(?:-y)?:\s*auto/);
});
