"use client";

import { FormEvent, useRef, useState } from "react";
import { X } from "lucide-react";
import { communityFlags } from "../lib/community";
import { supabase } from "../lib/supabase-browser";

type ShareSource = { id: string; title: string; objective: string | null; format: string | null; platform: string };

export function CommunityShareDialog({ source, onClose, onSubmitted }: {
  source: ShareSource; onClose: () => void; onSubmitted: (message: string) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const submissionKey = useRef<string | null>(null);
  if (!communityFlags.submissions) return null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setSubmitting(true); setError("");
    const form = new FormData(event.currentTarget);
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) { location.href = "/login"; return; }
    const { error: profileError } = await supabase.from("public_creator_profiles").upsert({ user_id: auth.session.user.id, display_name: String(form.get("public_name")), handle: String(form.get("public_handle")).toLowerCase(), is_active: true }, { onConflict: "user_id" });
    if (profileError) { setError("Este identificador público não está disponível."); setSubmitting(false); return; }
    const { data: version } = await supabase.from("content_versions").select("id").eq("content_plan_id", source.id)
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (!version) { setError("Confirme uma versão antes de compartilhar."); setSubmitting(false); return; }
    const split = (name: string) => String(form.get(name) ?? "").split(",").map((item) => item.trim()).filter(Boolean);
    submissionKey.current ??= crypto.randomUUID();
    const { error: rpcError } = await supabase.rpc("submit_community_content", {
      p_source_content_version_id: version.id,
      p_title: String(form.get("title")), p_summary: String(form.get("summary")),
      p_usage_notes: String(form.get("usage_notes") ?? ""), p_niches: split("niches"), p_tags: [...split("tags"), `archetype:${String(form.get("archetype"))}`],
      p_creative_type: String(form.get("creative_type")), p_format: source.format ?? "short-video",
      p_platform: source.platform, p_objective: source.objective ?? "",
      p_rights_confirmed: form.get("rights") === "on", p_adaptation_license_accepted: form.get("license") === "on",
      p_post_id: null, p_idempotency_key: submissionKey.current,
    });
    setSubmitting(false);
    if (rpcError) { setError("Não foi possível enviar. Revise os campos e tente novamente."); return; }
    submissionKey.current = null;
    onSubmitted("Roteiro enviado para moderação. O prazo inicial é de até dois dias úteis.");
    onClose();
  }
  return <div className="modal-backdrop"><form className="product-modal" onSubmit={submit}>
    <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar"><X/></button>
    <p className="eyebrow">COMPARTILHAR NA BIBLIOTECA</p><h2>Ajude outra pessoa a criar</h2>
    <p>Enviaremos a versão confirmada para moderação. Seu contexto privado não será compartilhado.</p>
    {error && <div className="product-alert error">{error}</div>}
    <div className="field-grid"><label>Nome público<input name="public_name" required minLength={2} maxLength={80} placeholder="Como quer ser reconhecido?"/></label><label>Identificador<input name="public_handle" required pattern="[a-z0-9_-]{3,30}" placeholder="seu_nome"/></label></div>
    <label>Título público<input name="title" required minLength={8} maxLength={140} defaultValue={source.title}/></label>
    <label>Resumo<textarea name="summary" required minLength={20} maxLength={500} placeholder="Explique para quem e para que este roteiro funciona."/></label>
    <label>Observações de uso<textarea name="usage_notes" maxLength={500} placeholder="Dicas para adaptar sem copiar literalmente."/></label>
    <div className="field-grid"><label>Tipo criativo<select name="creative_type" defaultValue="short_video"><option value="short_video">Vídeo curto</option><option value="ugc_ad">UGC</option><option value="instagram_carousel">Carrossel</option><option value="advertising_image">Imagem publicitária</option><option value="tech_educational_video">Educacional técnico</option></select></label>
      <label>Arquétipo<select name="archetype" defaultValue="educational"><option value="educational">Educacional</option><option value="humor">Humor</option><option value="affiliate">Afiliado</option><option value="service_offer">Oferta de serviço</option><option value="storytelling">Storytelling</option></select></label></div>
    <label>Nichos<input name="niches" required placeholder="fitness, humor"/></label>
    <label>Tags<input name="tags" placeholder="iniciante, tutorial, conversão"/></label>
    <label className="remember-pattern"><input name="rights" type="checkbox" required/><span><strong>Tenho os direitos necessários</strong>Este conteúdo é meu e não viola direitos de terceiros.</span></label>
    <label className="remember-pattern"><input name="license" type="checkbox" required/><span><strong>Permito exibição e adaptação</strong>Outros usuários poderão criar cópias privadas adaptadas dentro do Ritmo.</span></label>
    <button className="primary-button full" disabled={submitting}>{submitting ? "Enviando…" : "Enviar para moderação"}</button>
  </form></div>;
}
