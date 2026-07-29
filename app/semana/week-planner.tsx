"use client";

import { CalendarDays, Check, ChevronRight, LoaderCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "../../lib/supabase-browser";
import "../product.css";

type PlanItem = {
  title: string;
  platform: "instagram" | "tiktok";
  format: string;
  scheduled_for: string | null;
  rationale: string;
};

type PlanDraft = { rationale: string; items: PlanItem[] };

const gatewayUrl = "https://ritmo-api.gapet.com.br";

function nextMonday() {
  const date = new Date();
  const delta = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

export function WeekPlanner() {
  const [userId, setUserId] = useState("");
  const [context, setContext] = useState<Record<string, unknown>>({});
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [weekStart, setWeekStart] = useState(nextMonday);

  useEffect(() => {
    const db = supabase;
    if (!hasSupabaseConfig || !db) return;
    db.auth.getSession().then(async ({ data }) => {
      if (!data.session) { location.href = "/login"; return; }
      setUserId(data.session.user.id);
      const { data: profile } = await db.from("profiles").select("context,account_mode").single();
      const { data: preference } = await db.from("creator_preferences").select("niche_id,value").eq(
        "category", "content_taxonomy",
      ).maybeSingle();
      setContext({ ...(profile ?? {}), taxonomy: preference ?? {} });
    });
  }, []);

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = supabase;
    if (!db || !userId) return;
    const form = new FormData(event.currentTarget);
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return;
    setBusy(true);
    setDraft(null);
    setStatus("Preparando uma semana sustentável...");
    try {
      const response = await fetch(`${gatewayUrl}/v1/plans/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.session.access_token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `week:${userId}:${weekStart}`,
        },
        body: JSON.stringify({ payload: {
          week_start: weekStart,
          content_count: Number(form.get("content_count")),
          available_hours: Number(form.get("available_hours")),
          priorities: String(form.get("priorities") ?? ""),
          creator_context: context,
          locked_items: [],
        } }),
      });
      if (!response.ok) throw new Error();
      const queued = await response.json();
      const jobId = queued.job?.id;
      if (!jobId) throw new Error();
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const result = await fetch(`${gatewayUrl}/v1/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${auth.session.access_token}` },
        });
        if (!result.ok) throw new Error();
        const job = await result.json();
        setStatus(job.status === "waiting_retry" ? "Tentando novamente..." : `Status: ${job.status}`);
        if (job.status === "completed") {
          setDraft(job.result as PlanDraft);
          setStatus("Proposta pronta. Revise antes de confirmar.");
          setBusy(false);
          return;
        }
        if (["failed", "cancelled"].includes(job.status)) throw new Error();
      }
      throw new Error();
    } catch {
      setStatus("Não foi possível gerar o plano. Nenhuma mudança foi aplicada.");
      setBusy(false);
    }
  }

  async function confirm() {
    const db = supabase;
    if (!db || !draft || !userId) return;
    setBusy(true);
    setStatus("Confirmando sua semana...");
    const { data: existing } = await db.from("weekly_plans").select("version").eq(
      "week_start", weekStart,
    ).order("version", { ascending: false }).limit(1);
    const version = (existing?.[0]?.version ?? 0) + 1;
    const { data: weeklyPlan, error: weekError } = await db.from("weekly_plans").insert({
      user_id: userId,
      week_start: weekStart,
      version,
      status: "confirmed",
      rationale: draft.rationale,
      locked_at: new Date().toISOString(),
    }).select("id").single();
    if (weekError || !weeklyPlan) {
      setStatus("Não foi possível confirmar o plano.");
      setBusy(false);
      return;
    }
    const items = draft.items.map((item) => ({
      user_id: userId,
      weekly_plan_id: weeklyPlan.id,
      title: item.title,
      objective: item.rationale,
      platform: item.platform,
      format: item.format,
      status: item.scheduled_for ? "scheduled" : "idea",
      scheduled_for: item.scheduled_for,
      payload: { source: "weekly_plan", weekly_plan_version: version },
    }));
    const { error: itemsError } = await db.from("content_plans").insert(items);
    if (itemsError) {
      await db.from("weekly_plans").update({ status: "draft" }).eq("id", weeklyPlan.id);
      setStatus("O plano foi preservado como rascunho; os conteúdos não foram aplicados.");
    } else {
      setStatus(`Semana v${version} confirmada. Os conteúdos já aparecem no calendário.`);
      setDraft(null);
    }
    setBusy(false);
  }

  return <main className="week-page">
    <section className="week-wrap">
      <Link href="/" className="week-back">← Voltar ao Ritmo</Link>
      <header><span><CalendarDays/></span><div><p>MINHA SEMANA</p><h1>Planeje uma cadência possível</h1>
        <small>A IA propõe; você revisa e confirma.</small></div></header>
      <div className="week-layout">
        <form className="panel product-form" onSubmit={generate}>
          <label>Semana iniciando em<input type="date" value={weekStart} onChange={(event) => setWeekStart(event.target.value)} required/></label>
          <div className="field-grid"><label>Quantidade de conteúdos<input name="content_count" type="number" min="1" max="14" defaultValue="3" required/></label>
            <label>Horas disponíveis<input name="available_hours" type="number" min="1" max="80" defaultValue={Number(context.context && (context.context as Record<string, unknown>).weekly_hours) || 4} required/></label></div>
          <label>Prioridades da semana<textarea name="priorities" placeholder="Ex.: apresentar um serviço e manter o fim de semana livre"/></label>
          <button className="primary-button full" disabled={busy}>{busy ? <LoaderCircle className="spin"/> : <Sparkles/>} Gerar proposta</button>
          {status && <div className="week-status">{status}</div>}
        </form>
        <section className="panel week-draft">{!draft ? <div className="product-empty"><Sparkles/><strong>Sua proposta aparecerá aqui</strong>
          <span>Nenhum item entra no calendário antes da confirmação.</span></div> : <><span className="week-eyebrow">PROPOSTA REVISÁVEL</span>
          <h2>{draft.items.length} conteúdos</h2><p>{draft.rationale}</p><div className="week-items">{draft.items.map((item, index) =>
            <article key={`${item.title}-${index}`}><i>{index + 1}</i><div><strong>{item.title}</strong>
              <span>{item.platform} · {item.format}</span><small>{item.scheduled_for ? new Date(item.scheduled_for).toLocaleString("pt-BR") : "Sem horário proposto"}</small>
              <p>{item.rationale}</p></div></article>)}</div>
          <div className="human-confirmation"><Check/><span>Confirmar cria uma versão do plano e seus conteúdos. Você poderá editar cada ideia depois.</span></div>
          <button className="primary-button full" disabled={busy} onClick={() => void confirm()}>Confirmar minha semana <ChevronRight/></button></>}</section>
      </div>
    </section>
  </main>;
}
