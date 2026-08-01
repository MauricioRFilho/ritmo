import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import process from "node:process";

const postId = process.argv[2];
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const allowedTypes = new Set(["advertising_image", "instagram_carousel", "short_video", "tech_educational_video", "ugc_ad", "story_sequence", "live_stream", "newsletter"]);
if (!postId || !/^[0-9a-f-]{36}$/i.test(postId)) throw new Error("Uso: npm run promote:community -- <community_post_uuid>");
if (!url || !serviceKey) throw new Error("SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórios somente no terminal do moderador.");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", stdio: options.capture ? "pipe" : "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} falhou${result.stderr ? `: ${result.stderr.trim()}` : ""}`);
  return result.stdout?.trim() ?? "";
}
function canonicalModel(template, templateId) {
  if (!allowedTypes.has(template.creative_type)) throw new Error("Tipo criativo comunitário não suportado pelo catálogo oficial.");
  const snapshot = structuredClone(template.template_json ?? {});
  const creative = snapshot.creative && typeof snapshot.creative === "object" ? snapshot.creative : snapshot;
  if (template.creative_type === "instagram_carousel" && !Array.isArray(creative.slides)) {
    const text = Object.values(snapshot).flatMap((value) => typeof value === "string" ? [value] : []).filter(Boolean);
    creative.slides = [0, 1, 2].map((index) => ({
      headline: text[index] ?? `Parte ${index + 1}`,
      body: text[index + 3] ?? "Adapte este ponto ao contexto do novo criador.",
      alt_text: `Slide ${index + 1}: ${text[index] ?? "conteúdo adaptável"}`,
    }));
  }
  return {
    schema_version: 1,
    creative_type: template.creative_type,
    metadata: { title: template.title, objective: template.summary || "Adaptar conteúdo comunitário aprovado" },
    creative,
    constraints: { review_required: true },
    production: template.creative_type === "ugc_ad"
      ? { paid_partnership_disclosure: true, usage_rights_required: true }
      : { human_review_required: true },
    provenance: { template_id: templateId, template_version: template.version, origin: "ai", community_post_id: postId },
    performance: { status: "unmeasured" },
  };
}

const dirty = run("git", ["status", "--porcelain"], { capture: true });
if (dirty) throw new Error("A promoção exige worktree limpo para preservar alterações locais.");
const endpoint = new URL("/rest/v1/creative_template_catalog", url);
endpoint.searchParams.set("select", "id,template_key,version,title,summary,creative_type,template_json,community_post_id");
endpoint.searchParams.set("origin", "eq.community");
endpoint.searchParams.set("community_post_id", `eq.${postId}`);
endpoint.searchParams.set("editorial_status", "eq.approved");
endpoint.searchParams.set("active", "eq.true");
endpoint.searchParams.set("limit", "1");
const response = await fetch(endpoint, { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } });
if (!response.ok) throw new Error(`Catálogo recusou a consulta: ${response.status}`);
const [template] = await response.json();
if (!template) throw new Error("Nenhum template comunitário aprovado e ativo encontrado.");
const safeKey = String(template.template_key).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
const templateId = `${safeKey}-v${template.version}`;
const branch = `candidate/community-${templateId}`;
const source = `community-${templateId}.json`;
run("git", ["fetch", "origin", "main"]);
run("git", ["switch", "-c", branch, "origin/main"]);
try {
  await writeFile(`modelos/${source}`, `${JSON.stringify(canonicalModel(template, templateId), null, 2)}\n`, { flag: "wx" });
  const library = JSON.parse(await readFile("modelos/library.json", "utf8"));
  if (library.templates.some((item) => item.id === templateId || item.source === source)) throw new Error("Candidato já existe no catálogo Git.");
  library.templates.push({ id: templateId, creative_type: template.creative_type, source, status: "approved", promoted_from_community_post_id: postId });
  await writeFile("modelos/library.json", `${JSON.stringify(library, null, 2)}\n`);
  run("npm", ["run", "validate:creative-models"]);
  run("git", ["add", `modelos/${source}`, "modelos/library.json"]);
  run("git", ["commit", "-m", `feat(models): promote community candidate ${templateId}`]);
  run("git", ["push", "-u", "origin", branch]);
  run("gh", ["pr", "create", "--draft", "--base", "main", "--head", branch, "--title", `Candidato oficial: ${template.title} v${template.version}`, "--body", `Promovido da publicação comunitária ${postId}.\n\nRequer revisão humana de claims, direitos, disclosure, acessibilidade e performance editorial antes do merge.`]);
} catch (error) {
  process.stderr.write("A promoção parou sem commit direto na main. Revise ou descarte a branch candidata manualmente.\n");
  throw error;
}