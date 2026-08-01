"use client";

import { Bookmark, Flag, Heart, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { communityFlags } from "../../../lib/community";
import { hasSupabaseConfig, supabase } from "../../../lib/supabase-browser";

type Action = "like" | "save" | "report" | "adapt";
type Props = { postId: string | null; templateId: string; templateVersion: number; origin: "official" | "community" };

export function CommunityActions({ postId, templateId, templateVersion, origin }: Props) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [status, setStatus] = useState("");
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const adaptationKey = useRef<string | null>(null);
  async function act(action: Action) {
    if (!hasSupabaseConfig || !supabase) { location.href = `/login?return_to=${encodeURIComponent(location.pathname)}`; return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) { location.href = `/login?return_to=${encodeURIComponent(location.pathname)}`; return; }
    if (action !== "adapt" && !postId) return;
    setBusy(action); setStatus("");
    if (action === "adapt") {
      if (!templateId) { setBusy(null); setStatus("Este roteiro ainda não está disponível para adaptação."); return; }
      const gateway = process.env.NEXT_PUBLIC_AI_GATEWAY_URL ?? "https://ritmo-api.gapet.com.br";
      try {
        adaptationKey.current ??= crypto.randomUUID();
        const response = await fetch(`${gateway}/v1/content/adapt`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}`,
            "Idempotency-Key": adaptationKey.current },
          body: JSON.stringify({ template_id: templateId, template_version: templateVersion,
            adaptation_brief: "Adapte este modelo ao meu contexto autorizado, sem copiar literalmente.",
            community_post_id: origin === "community" ? postId : null }),
        });
        const result = await response.json() as { adaptation?: { content_plan_id?: string; job_id?: string }; content_plan_id?: string; job_id?: string; detail?: string };
        if (!response.ok) throw new Error(result.detail ?? "adaptation failed");
        const adaptation = result.adaptation ?? result;
        adaptationKey.current = null;
        const query = new URLSearchParams({ view: "content" });
        if (adaptation.content_plan_id) query.set("content_plan_id", adaptation.content_plan_id);
        if (adaptation.job_id) query.set("job_id", adaptation.job_id);
        location.href = `/?${query.toString()}`;
      } catch { setBusy(null); setStatus("Não foi possível adaptar agora. Tente novamente."); }
      return;
    }
    const rpc = action === "report" ? "report_community_post" : action === "like" ? "set_community_like" : "set_community_save";
    const args = action === "report" ? { p_post_id: postId, p_reason: "other", p_details: "Denúncia enviada pela página pública" } :
      { p_post_id: postId, p_active: action === "like" ? !liked : !saved };
    const { error } = await supabase.rpc(rpc, args);
    setBusy(null);
    if (error) { setStatus("Não foi possível concluir agora. Tente novamente."); return; }
    if (action === "like") setLiked((current) => !current);
    if (action === "save") setSaved((current) => !current);
    setStatus(action === "report" ? "Denúncia enviada para moderação." : action === "like" ? "Curtida atualizada." : "Salvo na sua coleção.");
  }
  return <div className="library-actions">
    {origin === "community" && communityFlags.interactions && <><button disabled={busy !== null} onClick={() => void act("like")}><Heart size={18}/> {liked ? "Curtido" : "Curtir"}</button>
      <button disabled={busy !== null} onClick={() => void act("save")}><Bookmark size={18}/> {saved ? "Salvo" : "Salvar"}</button>
      <button disabled={busy !== null} onClick={() => void act("report")}><Flag size={18}/> Denunciar</button></>}
    {communityFlags.adaptation && <button className="primary" disabled={busy !== null} onClick={() => void act("adapt")}><Sparkles size={18}/> Usar e adaptar</button>}
    {!communityFlags.adaptation && <a className="primary" href="/login">Entrar no Ritmo</a>}
    {status && <p className="library-status" role="status">{status}</p>}
  </div>;
}