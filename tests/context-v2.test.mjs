import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const dashboardPath = new URL("../app/ritmo-dashboard.tsx", import.meta.url);
const gatewayPath = new URL("../services/ai-gateway/app/main.py", import.meta.url);
const dashboard = () => readFile(dashboardPath, "utf8");

test("normaliza taxonomia legada sem migrar antes do salvamento", async () => {
  const source = await dashboard();
  assert.match(source, /type ContentTaxonomyV2/);
  assert.match(source, /function normalizeTaxonomy\s*\(/);
  for (const field of ["schema_version: 2", "primary_niche_id", "secondary_niche_ids", "custom_niches"])
    assert.ok(source.includes(field), `campo v2 ausente: ${field}`);
  assert.match(source, /normalizeTaxonomy\s*\([^)]*value[^)]*,[^)]*niche_id[^)]*\)/,
    "a leitura deve usar niche_id como fallback para registros legados");
  const load = source.slice(source.indexOf("async function loadData"), source.indexOf("async function saveOnboarding"));
  assert.doesNotMatch(load, /creator_preferences"\)\.upsert/,
    "carregar um registro legado não pode persistir uma migração");
});

test("taxonomia v2 oferece catálogo amplo e elimina duplicidade", async () => {
  const source = await dashboard();
  for (const category of ["Humor / comédia", "Lifestyle", "Tecnologia", "Educação", "Finanças", "Jurídico", "Imobiliário", "Outros"])
    assert.ok(source.toLocaleLowerCase("pt-BR").includes(category.toLocaleLowerCase("pt-BR")), `categoria ausente: ${category}`);
  assert.match(source, /function uniqueStrings\s*\(/);
  assert.match(source, /new Set\s*\(/);
});

test("editor cobre perfil completo e só autoriza após salvar", async () => {
  const source = await dashboard();
  for (const section of ["Perfil", "Conteúdo", "Público", "Estilo", "Monetização", "Objetivos", "Operação"])
    assert.match(source, new RegExp(`>${section}<`, "u"), `seção ausente: ${section}`);
  for (const field of ["audience", "audience_needs", "audience_interests", "audience_region", "style", "monetization", "preferred_cta", "weekly_hours", "restrictions"])
    assert.ok(source.includes(field), `campo ausente: ${field}`);
  assert.match(source, /className="[^"]*context-editor[^"]*"/);
  assert.match(source, /className=\{?`?[^\n}]*context-save-state/);
  for (const contract of ["Salvar contexto", "JSON.stringify"])
    assert.ok(source.includes(contract), `contrato ausente: ${contract}`);
  assert.match(source, /saving|Salvando/u);
  assert.match(source, /success|salvo|atualizado/iu);
  assert.match(source, /error|erro/iu);
  assert.match(source, /disabled=\{[^}]*!dirty|disabled=\{[^}]*saving/u);
});

test("salvamento persiste v2 e preserva niche_id", async () => {
  const source = await dashboard();
  const matches = [...source.matchAll(/(?:async function|const)\s+(save(?:Creator)?Context)\b/g)];
  assert.ok(matches.length > 0, "handler saveContext ausente");
  const start = matches[0].index;
  const next = source.indexOf("\n  async function", start + 1);
  const save = source.slice(start, next === -1 ? source.length : next);
  assert.match(save, /from\("profiles"\)\.update/);
  assert.match(save, /from\("creator_preferences"\)\.upsert/);
  assert.match(save, /niche_id:\s*[^,\n]*primary/u);
  assert.match(save, /value:\s*cleanTaxonomy/);
  assert.match(save, /normalizeTaxonomy\(payload\.taxonomy/);
});

test("gateway separa nichos, público, estilo, monetização, objetivos e restrições", async () => {
  const source = await readFile(gatewayPath, "utf8");
  for (const aliases of [["niches", "nichos"], ["audience", "publico"], ["style", "estilo"], ["monetization", "monetizacao"], ["objectives", "objetivos"], ["constraints", "restricoes"]])
    assert.ok(aliases.some((key) => new RegExp(`["']${key}["']\\s*:`, "u").test(source)), `dimensão ausente: ${aliases.join("/")}`);
  assert.doesNotMatch(source, /(?:niches|nichos)["']\s*:[^\n]*(?:monetization|monetizacao|style|estilo)/u);
});
