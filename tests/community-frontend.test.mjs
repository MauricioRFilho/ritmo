import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("blog falha fechado e comunica preparação sem feature flag", async () => {
  const response = await render("/blog");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /Biblioteca aberta/i);
  assert.match(html, /Biblioteca em preparação/);
  assert.match(html, /Entrar para criar/);
  assert.match(html, /noindex/i);
});

test("blog usa catálogo unificado, filtros completos e não recebe snapshot pelo cliente", async () => {
  const community = await source("lib/community.ts");
  const share = await source("app/community-share-dialog.tsx");
  const explorer = await source("app/blog/blog-explorer.tsx");
  assert.match(community, /community_library/);
  assert.match(community, /public_template_catalog/);
  assert.match(community, /officialPost/);
  for (const label of ["Nicho", "Formato", "Plataforma", "Objetivo", "Tipo criativo"]) assert.ok(explorer.includes(`aria-label="${label}"`));
  assert.match(explorer, /const pageSize = 12/);
  assert.match(explorer, /aria-label="Paginação da biblioteca"/);
  assert.match(explorer, /setPage\(1\)/);
  assert.doesNotMatch(community, /community_posts\?/);
  assert.match(share, /submit_community_content/);
  assert.match(share, /p_source_content_version_id/);
  assert.match(share, /p_idempotency_key: submissionKey\.current/);
  assert.match(share, /p_post_id: null/);
  for (const type of ["short_video", "ugc_ad", "instagram_carousel", "advertising_image", "tech_educational_video"]) assert.match(share, new RegExp(`value="${type}"`));
  assert.doesNotMatch(share, /value="(?:humor_sketch|affiliate_demo|carousel|ugc|tech_educational)"/);
  assert.doesNotMatch(share, /p_snapshot|p_payload|template_json/);
});

test("interações usam RPCs autenticadas e adaptação passa pelo gateway", async () => {
  const actions = await source("app/blog/[slug]/community-actions.tsx");
  for (const rpc of ["set_community_like", "set_community_save", "report_community_post"]) {
    assert.match(actions, new RegExp(rpc));
  }
  assert.match(actions, /getSession/);
  assert.match(actions, /\/v1\/content\/adapt/);
  assert.match(actions, /Idempotency-Key/);
  assert.match(actions, /adaptationKey\.current \?\?= crypto\.randomUUID/);
  assert.match(actions, /p_active/);
  assert.match(actions, /community_post_id/);
  assert.match(actions, /adaptation_brief: "Adapte este modelo ao meu contexto autorizado, sem copiar literalmente\."/);
  assert.doesNotMatch(actions, /create_private_community_adaptation/);
});

test("moderação é noindex, exige papel e usa RPC transacional", async () => {
  const page = await source("app/admin/moderacao/page.tsx");
  const queue = await source("app/admin/moderacao/moderation-queue.tsx");
  const proxy = await source("lib/supabase-proxy.ts");
  assert.match(page, /index: false/);
  assert.match(page, /is_community_moderator/);
  assert.match(page, /getClaims/);
  assert.match(queue, /moderate_community_submission/);
  assert.match(queue, /snapshot/);
  assert.match(queue, /rights_confirmed/);
  assert.match(queue, /adaptation_license_accepted/);
  assert.ok(proxy.includes('"/admin"'));
});

test("navegação e SEO expõem biblioteca, canonical, JSON-LD e sitemap", async () => {
  const dashboard = await source("app/ritmo-dashboard.tsx");
  const detail = await source("app/blog/[slug]/page.tsx");
  const sitemap = await source("app/sitemap.ts");
  const mine = await source("app/biblioteca/my-library.tsx");
  assert.ok(dashboard.includes('href="/blog"'));
  assert.match(detail, /CreativeWork/);
  assert.match(detail, /canonical/);
  assert.match(sitemap, /listCommunityPosts/);
  assert.match(mine, /withdraw_community_post/);
  assert.match(mine, /community_post_saves/);
  assert.match(mine, /submit_community_content/);
});
