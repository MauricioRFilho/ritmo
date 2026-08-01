"use client";

import { Check, LogOut, RefreshCw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase-browser";

type Submission = { id: string; post_id: string; author_user_id: string; title: string; summary: string; usage_notes: string | null; creative_type: string;
  format: string; submitted_at: string; snapshot: Record<string, unknown>; rights_confirmed: boolean;
  adaptation_license_accepted: boolean; author_name?: string; author_handle?: string | null };

export function ModerationQueue() {
  const [rows, setRows] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    const { data: submissions } = await supabase.from("community_submissions")
      .select("id,post_id,author_user_id,title,summary,usage_notes,creative_type,format,submitted_at,snapshot,rights_confirmed,adaptation_license_accepted")
      .eq("editorial_status", "pending").order("submitted_at", { ascending: true });
    const base = (submissions ?? []) as Submission[];
    const postIds = base.map((row) => row.post_id);
    const { data: posts } = postIds.length ? await supabase.from("community_posts").select("id,author_profile_id").in("id", postIds) : { data: [] };
    const profileIds = (posts ?? []).map((row) => row.author_profile_id);
    const { data: profiles } = profileIds.length ? await supabase.from("public_creator_directory").select("id,display_name,handle").in("id", profileIds) : { data: [] };
    const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const authorByPost = new Map((posts ?? []).map((post) => [post.id, profileById.get(post.author_profile_id)]));
    setRows(base.map((row) => ({ ...row, author_name: authorByPost.get(row.post_id)?.display_name ?? `Criador ${row.author_user_id.slice(0, 8)}`,
      author_handle: authorByPost.get(row.post_id)?.handle ?? null })));
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function moderate(id: string, decision: "approved" | "rejected" | "changes_requested") {
    if (!supabase) return;
    const reason = decision === "approved" ? null : window.prompt("Informe o motivo para o criador:");
    if (decision !== "approved" && !reason?.trim()) return;
    setNotice("Registrando decisão…");
    const { error } = await supabase.rpc("moderate_community_submission", { p_submission_id: id, p_decision: decision, p_reason: reason });
    if (error) { setNotice("Não foi possível registrar a decisão."); return; }
    setNotice("Decisão registrada no histórico de moderação.");
    await load();
  }

  if (loading) return <div className="moderation-state">Carregando fila segura…</div>;
  return <div className="moderation-shell">
    <header><div><span>OPERAÇÃO EDITORIAL</span><h1>Fila de moderação</h1><p>Revise direitos, claims, segurança e utilidade antes de publicar.</p></div>
      <div><button onClick={() => void load()}><RefreshCw/> Atualizar</button><Link href="/"><LogOut/> Sair</Link></div></header>
    {notice && <p className="moderation-notice" role="status">{notice}</p>}
    <section className="moderation-list">{rows.length === 0 ? <div className="moderation-empty"><Check/><h2>Fila em dia</h2><p>Não há submissões aguardando revisão.</p></div> :
      rows.map((row) => <article key={row.id}><div className="moderation-copy"><span>{row.creative_type} · {row.format}</span><h2>{row.title}</h2>
        <p>{row.summary}</p><small>Por {row.author_name}{row.author_handle ? ` · @${row.author_handle}` : ""} · {new Date(row.submitted_at).toLocaleDateString("pt-BR")}</small>
        {row.usage_notes && <section className="moderation-notes"><strong>Observações de uso</strong><p>{row.usage_notes}</p></section>}
        <section className="moderation-consents" aria-label="Consentimentos"><span>{row.rights_confirmed ? "✓" : "✕"} Direitos confirmados</span><span>{row.adaptation_license_accepted ? "✓" : "✕"} Adaptação autorizada</span></section>
        <details className="moderation-snapshot"><summary>Revisar snapshot estruturado</summary><pre>{JSON.stringify(row.snapshot, null, 2)}</pre></details></div>
        <div className="moderation-actions"><button className="approve" onClick={() => void moderate(row.id, "approved")}><Check/> Aprovar</button>
          <button onClick={() => void moderate(row.id, "changes_requested")}>Solicitar ajustes</button>
          <button className="reject" onClick={() => void moderate(row.id, "rejected")}><X/> Rejeitar</button></div></article>)}</section>
  </div>;
}