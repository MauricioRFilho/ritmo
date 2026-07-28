"use client";

import { Check, Download, LoaderCircle, Shield, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "../../lib/supabase-browser";
import "../product.css";

const exportTables = [
  "profiles", "creator_preferences", "equipment_items", "available_locations",
  "platform_profiles", "creator_goals", "recurring_availability",
  "schedule_exceptions", "weekly_plans", "content_plans", "content_tasks",
  "content_versions", "publication_results", "metric_snapshots",
  "conversations", "messages", "conversation_summaries", "creator_memories",
  "memory_sources", "ai_jobs", "ai_usage_events", "audit_events",
];

export function DataControls() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState("");
  const [requests, setRequests] = useState<Array<{ id: string; request_type: string; status: string; requested_at: string }>>([]);

  useEffect(() => {
    const db = supabase;
    if (!hasSupabaseConfig || !db) { setLoading(false); return; }
    db.auth.getSession().then(async ({ data }) => {
      if (!data.session) { location.href = "/login"; return; }
      setUserId(data.session.user.id);
      const { data: history } = await db.from("privacy_requests").select(
        "id,request_type,status,requested_at",
      ).order("requested_at", { ascending: false });
      setRequests(history ?? []);
      setLoading(false);
    });
  }, []);

  async function exportData() {
    const db = supabase;
    if (!db || !userId) return;
    setBusy(true);
    setStatus("Preparando seu arquivo...");
    const payload: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      format_version: 1,
      user_id: userId,
    };
    for (const table of exportTables) {
      const { data, error } = await db.from(table).select("*");
      payload[table] = error ? { error: "indisponível para exportação" } : data;
    }
    await db.from("privacy_requests").insert({
      user_id: userId, request_type: "export", status: "requested",
    });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ritmo-dados-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Exportação concluída.");
    setBusy(false);
  }

  async function requestDeletion() {
    const db = supabase;
    if (!db || !userId || confirmation !== "EXCLUIR") return;
    setBusy(true);
    const { error } = await db.from("privacy_requests").insert({
      user_id: userId, request_type: "deletion", status: "requested",
    });
    if (error) {
      setStatus("Não foi possível registrar a solicitação.");
    } else {
      setStatus("Solicitação registrada. Sua conta foi desconectada para impedir novas alterações.");
      await db.auth.signOut();
      setTimeout(() => { location.href = "/login"; }, 1200);
    }
    setBusy(false);
  }

  if (loading) return <main className="product-loading"><LoaderCircle className="spin"/><strong>Carregando seus controles…</strong></main>;
  if (!hasSupabaseConfig) return <main className="product-loading"><Shield/><strong>Controles indisponíveis sem Supabase</strong><Link href="/">Voltar</Link></main>;

  return <main className="data-page">
    <section className="data-wrap">
      <Link href="/" className="data-back">← Voltar ao Ritmo</Link>
      <header><span><Shield/></span><div><p>PRIVACIDADE</p><h1>Seus dados, sob seu controle</h1>
        <small>Exporte uma cópia ou solicite a exclusão da conta.</small></div></header>
      {status && <div className="data-status"><Check/>{status}</div>}
      <article><div><Download/><h2>Exportar meus dados</h2><p>Baixe um JSON com perfil, contexto, conteúdos, versões, conversas, memórias, métricas e registros da sua conta.</p></div>
        <button className="primary-button" disabled={busy} onClick={() => void exportData()}><Download/> Baixar exportação</button></article>
      <article className="danger"><div><Trash2/><h2>Solicitar exclusão</h2><p>O pedido entra na fila operacional de privacidade. A exclusão definitiva precisa ser processada e auditada pelo responsável do serviço.</p></div>
        <label>Digite <strong>EXCLUIR</strong> para confirmar<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)}/></label>
        <button disabled={busy || confirmation !== "EXCLUIR"} onClick={() => void requestDeletion()}><Trash2/> Solicitar exclusão e sair</button></article>
      <section className="request-history"><h2>Histórico de solicitações</h2>{requests.length === 0 ? <p>Nenhuma solicitação anterior.</p> :
        requests.map((request) => <div key={request.id}><strong>{request.request_type === "export" ? "Exportação" : "Exclusão"}</strong>
          <span>{request.status}</span><time>{new Date(request.requested_at).toLocaleString("pt-BR")}</time></div>)}</section>
      <p className="data-footnote">Solicitações de exclusão são registradas para auditoria. O prazo e o canal oficial precisam constar na política operacional de produção.</p>
    </section>
  </main>;
}

