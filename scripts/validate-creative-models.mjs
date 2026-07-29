import { readFile, access } from "node:fs/promises";
import { resolve, dirname, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelsDir = resolve(root, "modelos");
const library = JSON.parse(await readFile(resolve(modelsDir, "library.json"), "utf8"));
const allowedTypes = new Set(["advertising_image", "instagram_carousel", "short_video", "tech_educational_video", "ugc_ad"]);
const ids = new Set();
const sources = new Set();
const errors = [];
const legacySources = new Set(["advertising_image.json", "instagram_carousel.json", "short_video.json", "tech_educational_video.json", "ugc.json"]);

const requireText = (value, path) => {
  if (typeof value !== "string" || value.trim().length < 3) errors.push(`${path}: texto obrigatório`);
};
const collectScenes = (model) => model.creative?.scenes ?? model.creative?.production?.shots ?? model.production?.shots ?? [];

if (library.schema_version !== 1) errors.push("library.json: schema_version deve ser 1");
if (!Array.isArray(library.templates) || library.templates.length === 0) errors.push("library.json: templates vazio");
if (!library.approval_policy || library.approval_policy.memory_status !== "suggested") errors.push("library.json: memória precisa nascer como suggested");
if (!Array.isArray(library.approval_policy?.performance_status) || !library.approval_policy.performance_status.includes("performance_validated")) {
  errors.push("library.json: separar performance_validated de medição");
}

for (const entry of library.templates ?? []) {
  if (typeof entry.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id)) errors.push("template id inválido: use slug não vazio");
  if (typeof entry.source !== "string" || entry.source !== basename(entry.source) || extname(entry.source) !== ".json" || entry.source === "library.json") {
    errors.push(`${entry.id ?? "template"}: source deve ser um arquivo .json direto de modelos/`);
    continue;
  }
  if (ids.has(entry.id)) errors.push(`template_id duplicado: ${entry.id}`);
  if (sources.has(entry.source)) errors.push(`source duplicado: ${entry.source}`);
  ids.add(entry.id); sources.add(entry.source);
  if (!allowedTypes.has(entry.creative_type)) errors.push(`${entry.id}: creative_type inválido`);
  const sourcePath = resolve(modelsDir, entry.source ?? "");
  try { await access(sourcePath); } catch { errors.push(`${entry.id}: arquivo ausente ${entry.source}`); continue; }
  let model;
  try { model = JSON.parse(await readFile(sourcePath, "utf8")); } catch (error) { errors.push(`${entry.id}: JSON inválido (${error.message})`); continue; }
  const type = model.creative_type ?? model.creator_type;
  if (type !== entry.creative_type) errors.push(`${entry.id}: tipo do índice diverge do arquivo`);
  if (model.schema_version === undefined && !legacySources.has(entry.source)) errors.push(`${entry.id}: somente fixtures legadas conhecidas podem omitir schema_version`);
  if (model.schema_version !== undefined && model.schema_version !== 1) errors.push(`${entry.id}: schema_version não suportada`);
  if (model.schema_version === 1) {
    requireText(model.metadata?.title, `${entry.id}.metadata.title`);
    requireText(model.metadata?.objective, `${entry.id}.metadata.objective`);
    if (!model.creative || typeof model.creative !== "object") errors.push(`${entry.id}.creative: obrigatório`);
    if (!model.constraints || typeof model.constraints !== "object") errors.push(`${entry.id}.constraints: obrigatório`);
    if (!model.production || typeof model.production !== "object") errors.push(`${entry.id}.production: obrigatório`);
    if (!Number.isInteger(model.provenance?.template_version) || model.provenance.template_version < 1) errors.push(`${entry.id}: provenance.template_version inválido`);
    if (model.provenance?.template_id !== entry.id) errors.push(`${entry.id}: provenance.template_id divergente`);
    if (model.provenance?.origin !== "seed" && model.provenance?.origin !== "ai") errors.push(`${entry.id}: provenance.origin inválido`);
    if (model.performance?.status === "performance_validated" && !model.performance?.metrics) errors.push(`${entry.id}: performance validada sem métricas`);
    const scenes = collectScenes(model);
    if (["short_video", "ugc_ad", "tech_educational_video"].includes(type) && scenes.length) {
      const total = scenes.reduce((sum, scene) => sum + Number(scene.duration_seconds ?? 0), 0);
      const max = Number(model.constraints?.max_duration_seconds ?? 60);
      if (total <= 0 || total > max) errors.push(`${entry.id}: duração ${total}s fora do máximo ${max}s`);
      const target = Number(model.constraints?.target_duration_seconds ?? total);
      if (Math.abs(total - target) > 3) errors.push(`${entry.id}: cenas somam ${total}s, alvo ${target}s`);
    }
    if (type === "ugc_ad") {
      const benefit = model.creative?.benefit;
      if (benefit?.claim && (!benefit.evidence_required || !benefit.proof_shot)) errors.push(`${entry.id}: claim UGC sem prova exigida`);
      if (model.production?.paid_partnership_disclosure !== true) errors.push(`${entry.id}: disclosure publicitário obrigatório`);
      if (model.production?.usage_rights_required !== true) errors.push(`${entry.id}: direitos de uso obrigatórios`);
    }
    if (type === "instagram_carousel") {
      const slides = model.creative?.slides ?? [];
      if (slides.length < 3 || slides.length > 10) errors.push(`${entry.id}: carrossel deve ter 3–10 slides`);
      if (slides.some((slide) => !slide.alt_text)) errors.push(`${entry.id}: todo slide precisa de alt_text`);
    }
  }
}

if (errors.length) {
  console.error(`Biblioteca criativa inválida (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Biblioteca criativa válida: ${library.templates.length} modelos, pronta para revisão humana.`);

