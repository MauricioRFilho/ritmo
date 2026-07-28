"use client";

import {
  BarChart3, CalendarDays, Check, ChevronRight, CircleUserRound, Clock3,
  FileText, Home, Lightbulb, LoaderCircle, LogOut, Menu, Plus, RefreshCw,
  Send, Sparkles, Target, Video, X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase-browser";
import "./product.css";

type Platform = "instagram" | "tiktok";
type AccountMode = "hobby" | "professional" | "team";
type View = "today" | "calendar" | "content" | "performance" | "memories" | "context";

type Profile = {
  user_id: string;
  display_name: string | null;
  handle: string | null;
  onboarding_completed: boolean;
  account_mode: AccountMode;
  timezone: string;
  context: Record<string, unknown>;
};

type ContentPlan = {
  id: string;
  title: string;
  objective: string | null;
  platform: Platform;
  format: string | null;
  status: string;
  scheduled_for: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type ContentPackage = {
  objective: string;
  hooks: string[];
  scenes: Array<{ order: number; visual: string; speech: string; duration_seconds: number }>;
  capture_notes: string[];
  editing_notes: string[];
  caption: string;
  cta: string;
  hashtags: string[];
  suggested_time?: string | null;
};

type ChatMessage = { id?: string; role: "user" | "assistant"; content: string };
type Memory = { id: string; category: string; content: string; status: string; confidence: number };
type Publication = { id: string; content_plan_id: string | null; metrics: Record<string, number>; published_at: string };

const navigation = [
  { id: "today" as View, label: "Hoje", icon: Home },
  { id: "calendar" as View, label: "Calendário", icon: CalendarDays },
  { id: "content" as View, label: "Conteúdos", icon: Video },
  { id: "performance" as View, label: "Desempenho", icon: BarChart3 },
  { id: "memories" as View, label: "Memórias", icon: Lightbulb },
  { id: "context" as View, label: "Meu contexto", icon: CircleUserRound },
];

const niches = [
  ["influencer-geral", "Lifestyle"],
  ["esporte-geral", "Esporte"],
  ["corrida", "Corrida"],
  ["maquiagem-beauty", "Maquiagem / Beauty"],
  ["culinaria", "Culinária"],
  ["negocios-educacao-financeira", "Negócios / Finanças"],
];

const gatewayUrl = process.env.NEXT_PUBLIC_AI_GATEWAY_URL ?? "http://localhost:8000";

function formatDate(value: string | null, options?: Intl.DateTimeFormatOptions) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", options ?? {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: string) {
  return ({
    idea: "Ideia",
    generating: "Gerando",
    review: "Em revisão",
    ready: "Roteiro pronto",
    scheduled: "Agendado",
    published: "Publicado",
  } as Record<string, string>)[status] ?? status;
}

export function RitmoDashboard() {
  const [view, setView] = useState<View>("today");
  const [mobileNav, setMobileNav] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [niche, setNiche] = useState("");
  const [ideaOpen, setIdeaOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ContentPlan | null>(null);
  const [draft, setDraft] = useState<ContentPackage | null>(null);
  const [jobStatus, setJobStatus] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [conversationId, setConversationId] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const loadData = useCallback(async () => {
    const db = supabase;
    if (!hasSupabaseConfig || !db) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) {
      location.href = "/login";
      return;
    }
    const userId = auth.session.user.id;
    const [profileResult, plansResult, preferencesResult, memoriesResult, publicationsResult] = await Promise.all([
      db.from("profiles").select("*").eq("user_id", userId).single(),
      db.from("content_plans").select("*").order("scheduled_for", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      db.from("creator_preferences").select("niche_id,value").eq("category", "content_taxonomy").maybeSingle(),
      db.from("creator_memories").select("id,category,content,status,confidence").order("created_at", { ascending: false }),
      db.from("publication_results").select("id,content_plan_id,metrics,published_at").order("published_at", { ascending: false }),
    ]);
    if (profileResult.error) {
      setError("Não foi possível carregar seu perfil.");
    } else {
      setProfile(profileResult.data as Profile);
    }
    setPlans((plansResult.data ?? []) as ContentPlan[]);
    setNiche(preferencesResult.data?.niche_id ?? "");
    setMemories((memoriesResult.data ?? []) as Memory[]);
    setPublications((publicationsResult.data ?? []) as Publication[]);
    setLoading(false);
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const scheduled = useMemo(
    () => plans.filter((plan) => plan.scheduled_for),
    [plans],
  );
  const nextPlan = scheduled.find((plan) => new Date(plan.scheduled_for!).getTime() >= Date.now()) ?? plans[0];
  const monthGroups = useMemo(() => {
    const groups = new Map<string, ContentPlan[]>();
    for (const plan of scheduled) {
      const key = new Date(plan.scheduled_for!).toISOString().slice(0, 10);
      groups.set(key, [...(groups.get(key) ?? []), plan]);
    }
    return groups;
  }, [scheduled]);

  async function saveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = supabase;
    if (!db || !profile) return;
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("display_name") ?? "").trim();
    const accountMode = String(form.get("account_mode")) as AccountMode;
    const selectedNiche = String(form.get("niche_id"));
    const platform = String(form.get("platform")) as Platform;
    const weeklyHours = Number(form.get("weekly_hours"));
    setNotice("Salvando seu contexto...");
    const { error: profileError } = await db.from("profiles").update({
      display_name: displayName,
      account_mode: accountMode,
      onboarding_completed: true,
      context: { weekly_hours: weeklyHours },
      updated_at: new Date().toISOString(),
    }).eq("user_id", profile.user_id);
    const { error: preferenceError } = await db.from("creator_preferences").upsert({
      user_id: profile.user_id,
      category: "content_taxonomy",
      niche_id: selectedNiche,
      value: { niche_id: selectedNiche },
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,category" });
    const { error: platformError } = await db.from("platform_profiles").upsert({
      user_id: profile.user_id,
      platform,
    }, { onConflict: "user_id,platform" });
    if (profileError || preferenceError || platformError) {
      setNotice("");
      setError("Não foi possível concluir o onboarding. Revise os dados e tente novamente.");
      return;
    }
    setNotice("Contexto salvo.");
    await loadData();
  }

  async function createIdea(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = supabase;
    if (!db || !profile) return;
    const form = new FormData(event.currentTarget);
    const record = {
      user_id: profile.user_id,
      title: String(form.get("title")).trim(),
      objective: String(form.get("objective")).trim(),
      platform: String(form.get("platform")) as Platform,
      format: String(form.get("format")).trim(),
      status: "idea",
      payload: { niche_id: niche },
    };
    setNotice("Salvando ideia...");
    const { data, error: insertError } = await db.from("content_plans").insert(record).select("*").single();
    if (insertError) {
      setError("Não foi possível salvar a ideia.");
      setNotice("");
      return;
    }
    setPlans((current) => [data as ContentPlan, ...current]);
    setIdeaOpen(false);
    setNotice("Ideia salva. Você já pode gerar o roteiro.");
    setSelectedPlan(data as ContentPlan);
    setView("content");
  }

  async function generateContent(plan: ContentPlan) {
    const db = supabase;
    if (!db) return;
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return;
    setSelectedPlan(plan);
    setStudioOpen(true);
    setDraft(null);
    setJobStatus("Enviando para o estúdio...");
    await db.from("content_plans").update({ status: "generating" }).eq("id", plan.id);
    try {
      const response = await fetch(`${gatewayUrl}/v1/content/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.session.access_token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `content:${plan.id}:${Date.now()}`,
        },
        body: JSON.stringify({ payload: {
          content_plan_id: plan.id,
          title: plan.title,
          objective: plan.objective,
          platform: plan.platform,
          format: plan.format,
          niche_id: niche,
          creator_context: profile?.context ?? {},
        } }),
      });
      if (!response.ok) throw new Error(await response.text());
      const queued = await response.json();
      const jobId = queued.job?.id;
      if (!jobId) throw new Error("Job não retornado");
      for (let attempt = 0; attempt < 90; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const statusResponse = await fetch(`${gatewayUrl}/v1/jobs/${jobId}`, {
          headers: { Authorization: `Bearer ${auth.session.access_token}` },
        });
        if (!statusResponse.ok) throw new Error("Falha ao acompanhar geração");
        const job = await statusResponse.json();
        setJobStatus(job.status === "waiting_retry" ? "Tentando novamente..." : `Geração: ${statusLabel(job.status)}`);
        if (job.status === "completed") {
          setDraft(job.result as ContentPackage);
          setJobStatus("Roteiro pronto para sua revisão.");
          await db.from("content_plans").update({ status: "review" }).eq("id", plan.id);
          await loadData();
          return;
        }
        if (["failed", "cancelled"].includes(job.status)) throw new Error(job.error_code ?? job.status);
      }
      throw new Error("Tempo limite excedido");
    } catch {
      await db.from("content_plans").update({ status: "idea" }).eq("id", plan.id);
      setJobStatus("A geração falhou. Sua ideia foi preservada; tente novamente.");
    }
  }

  async function confirmContent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = supabase;
    if (!db || !selectedPlan || !draft || !profile) return;
    const form = new FormData(event.currentTarget);
    const scheduledFor = String(form.get("scheduled_for"));
    const edited: ContentPackage = {
      ...draft,
      caption: String(form.get("caption")),
      cta: String(form.get("cta")),
    };
    const { data: versions } = await db.from("content_versions").select("version").eq(
      "content_plan_id", selectedPlan.id,
    ).order("version", { ascending: false }).limit(1);
    const nextVersion = (versions?.[0]?.version ?? 0) + 1;
    const { error: versionError } = await db.from("content_versions").insert({
      user_id: profile.user_id,
      content_plan_id: selectedPlan.id,
      version: nextVersion,
      payload: edited,
    });
    const { error: planError } = await db.from("content_plans").update({
      status: "scheduled",
      scheduled_for: new Date(scheduledFor).toISOString(),
      payload: { ...selectedPlan.payload, confirmed_version: nextVersion },
      updated_at: new Date().toISOString(),
    }).eq("id", selectedPlan.id);
    if (versionError || planError) {
      setError("Não foi possível confirmar o roteiro.");
      return;
    }
    setStudioOpen(false);
    setNotice(`Roteiro v${nextVersion} confirmado e agendado.`);
    await loadData();
  }

  async function openChat() {
    const db = supabase;
    if (!db || !profile) return;
    setChatOpen(true);
    let id = conversationId;
    if (!id) {
      const { data: existing } = await db.from("conversations").select("id").eq("is_primary", true).maybeSingle();
      if (existing?.id) id = existing.id;
      else {
        const { data: created } = await db.from("conversations").insert({
          user_id: profile.user_id, title: "Meu copiloto", is_primary: true,
        }).select("id").single();
        id = created?.id ?? "";
      }
      setConversationId(id);
    }
    if (id) {
      const { data } = await db.from("messages").select("id,role,content").eq(
        "conversation_id", id,
      ).in("role", ["user", "assistant"]).order("created_at");
      setMessages((data ?? []) as ChatMessage[]);
    }
  }

  async function sendMessage() {
    const db = supabase;
    const text = chatInput.trim();
    if (!db || !text || chatLoading) return;
    let id = conversationId;
    if (!id) {
      await openChat();
      const { data } = await db.from("conversations").select("id").eq("is_primary", true).single();
      id = data?.id ?? "";
    }
    if (!id) return;
    const { data: auth } = await db.auth.getSession();
    if (!auth.session) return;
    setChatInput("");
    setChatLoading(true);
    setMessages((current) => [...current, { role: "user", content: text }, { role: "assistant", content: "" }]);
    try {
      const response = await fetch(`${gatewayUrl}/v1/chat/stream`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${auth.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ conversation_id: id, message: text, context_scope: view }),
      });
      if (!response.ok || !response.body) throw new Error();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() ?? "";
        for (const block of blocks) {
          const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine || block.startsWith("event: done")) continue;
          const item = JSON.parse(dataLine.slice(6));
          if (item.delta) {
            answer += item.delta;
            setMessages((current) => [
              ...current.slice(0, -1),
              { role: "assistant", content: answer },
            ]);
          }
        }
      }
    } catch {
      setMessages((current) => [
        ...current.slice(0, -1),
        { role: "assistant", content: "Não consegui responder agora. Sua mensagem não alterou nenhum dado." },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function updateMemory(memory: Memory, status: "confirmed" | "rejected" | "archived") {
    const db = supabase;
    if (!db) return;
    const { error: updateError } = await db.from("creator_memories").update({
      status, updated_at: new Date().toISOString(),
    }).eq("id", memory.id);
    if (updateError) setError("Não foi possível atualizar a memória.");
    else setMemories((current) => current.map((item) => item.id === memory.id ? { ...item, status } : item));
  }

  async function recordPublication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const db = supabase;
    if (!db || !profile) return;
    const form = new FormData(event.currentTarget);
    const planId = String(form.get("content_plan_id"));
    const plan = plans.find((item) => item.id === planId);
    if (!plan) return;
    const { error: publicationError } = await db.from("publication_results").insert({
      user_id: profile.user_id,
      content_plan_id: planId,
      platform: plan.platform,
      published_at: new Date(String(form.get("published_at"))).toISOString(),
      url: String(form.get("url") ?? ""),
      metrics: {
        views: Number(form.get("views")),
        likes: Number(form.get("likes")),
        comments: Number(form.get("comments")),
        saves: Number(form.get("saves")),
      },
    });
    if (publicationError) setError("Não foi possível registrar o resultado.");
    else {
      await db.from("content_plans").update({ status: "published" }).eq("id", planId);
      setNotice("Publicação registrada. O resultado já entra no seu histórico.");
      await loadData();
    }
  }

  async function signOut() {
    await supabase?.auth.signOut();
    location.href = "/login";
  }

  if (loading) {
    return <main className="product-loading"><LoaderCircle className="spin"/><strong>Preparando seu ritmo…</strong><span>Carregando apenas os seus dados.</span></main>;
  }

  if (!hasSupabaseConfig || !supabase) {
    return <main className="product-loading">
      <Sparkles/>
      <strong>Ritmo em modo de configuração</strong>
      <span>Conecte o Supabase para usar onboarding, calendário, IA e memória reais.</span>
      <a href="/login">Abrir configuração de acesso</a>
    </main>;
  }

  return <main className="product-shell">
    <aside className={`product-sidebar ${mobileNav ? "open" : ""}`}>
      <div className="product-brand"><span><Sparkles size={18}/></span>ritmo <em>beta</em></div>
      <button className="sidebar-close" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X/></button>
      <nav>{navigation.map(({ id, label, icon: Icon }) =>
        <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); setMobileNav(false); }}>
          <Icon size={18}/><span>{label}</span>
          {id === "memories" && memories.filter((item) => item.status === "suggested").length > 0 &&
            <small>{memories.filter((item) => item.status === "suggested").length}</small>}
        </button>)}
      </nav>
      <div className="sidebar-account">
        <div className="avatar">{profile?.display_name?.slice(0, 2).toUpperCase() ?? "RC"}</div>
        <div><strong>{profile?.display_name ?? "Criador"}</strong><span>{profile?.account_mode ?? "professional"}</span></div>
        <button onClick={signOut} aria-label="Sair"><LogOut size={17}/></button>
      </div>
    </aside>

    <section className="product-workspace">
      <header className="product-topbar">
        <button className="nav-trigger" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu/></button>
        <div><p>{formatDate(new Date().toISOString(), { weekday: "long", day: "numeric", month: "long" })}</p>
          <h1>Seu conteúdo está ganhando <span>ritmo.</span></h1></div>
        <div className="topbar-actions">
          <span className="real-data"><i/> dados reais</span>
          <button className="secondary-button" onClick={() => void loadData()}><RefreshCw size={15}/> Atualizar</button>
          <button className="primary-button" onClick={() => setIdeaOpen(true)}><Plus size={16}/> Nova ideia</button>
        </div>
      </header>

      {(error || notice) && <div className={`product-alert ${error ? "error" : ""}`}>
        <span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }} aria-label="Fechar"><X size={15}/></button>
      </div>}

      {view === "today" && <TodayView plans={plans} nextPlan={nextPlan} publications={publications}
        onCreate={() => setIdeaOpen(true)} onGenerate={generateContent}/>}
      {view === "calendar" && <CalendarView groups={monthGroups} onSelect={(plan) => { setSelectedPlan(plan); setView("content"); }}/>}
      {view === "content" && <ContentView plans={plans} selected={selectedPlan} onSelect={setSelectedPlan}
        onCreate={() => setIdeaOpen(true)} onGenerate={generateContent}/>}
      {view === "performance" && <PerformanceView plans={plans} publications={publications} onSubmit={recordPublication}/>}
      {view === "memories" && <MemoriesView memories={memories} onUpdate={updateMemory}/>}
      {view === "context" && <ContextView profile={profile} niche={niche}/>}
    </section>

    <button className="copilot-trigger" onClick={() => void openChat()}><Sparkles size={18}/><span>Copiloto</span></button>
    {chatOpen && <aside className="product-copilot">
      <header><div><Sparkles size={17}/></div><span><strong>Seu copiloto</strong><small>Contexto autorizado</small></span>
        <button onClick={() => setChatOpen(false)} aria-label="Fechar copiloto"><X size={17}/></button></header>
      <div className="chat-messages">{messages.length === 0 &&
        <div className="chat-intro"><strong>Como posso ajudar?</strong><span>Eu uso apenas seu contexto confirmado e nunca altero sua agenda sem aprovação.</span></div>}
        {messages.map((item, index) => <div key={item.id ?? index} className={`chat-message ${item.role}`}>{item.content || "…"}</div>)}
      </div>
      <div className="chat-composer"><textarea value={chatInput} onChange={(event) => setChatInput(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }}
        placeholder="Converse com seu especialista…"/><button disabled={chatLoading} onClick={() => void sendMessage()} aria-label="Enviar"><Send size={16}/></button>
        <small>A IA pode errar. Revise antes de confirmar mudanças.</small></div>
    </aside>}

    {!profile?.onboarding_completed && profile && <Onboarding profile={profile} onSubmit={saveOnboarding}/>}
    {ideaOpen && <IdeaDialog onClose={() => setIdeaOpen(false)} onSubmit={createIdea}/>}
    {studioOpen && selectedPlan && <StudioDialog plan={selectedPlan} draft={draft} status={jobStatus}
      onClose={() => setStudioOpen(false)} onSubmit={confirmContent}/>}
  </main>;
}

function TodayView({ plans, nextPlan, publications, onCreate, onGenerate }: {
  plans: ContentPlan[]; nextPlan?: ContentPlan; publications: Publication[];
  onCreate: () => void; onGenerate: (plan: ContentPlan) => void;
}) {
  const thisWeek = plans.filter((plan) => Date.now() - new Date(plan.created_at).getTime() < 7 * 86400000).length;
  const views = publications.reduce((total, publication) => total + Number(publication.metrics.views ?? 0), 0);
  return <div className="view-stack">
    <section className="pulse-card"><div><span><Sparkles size={13}/> PULSO DO DIA</span>
      <h2>Crie com intenção.<br/><em>Publique no seu ritmo.</em></h2>
      <p>{nextPlan ? <>Seu próximo passo é <strong>{nextPlan.title}</strong>.</> : "Seu calendário está livre para uma nova ideia."}</p></div>
      <button className="primary-button" onClick={onCreate}><Plus size={16}/> Capturar ideia</button></section>
    <section className="metric-grid">
      <article><span>Conteúdos esta semana</span><strong>{thisWeek}</strong><small>criados por você</small></article>
      <article><span>Agendados</span><strong>{plans.filter((item) => item.status === "scheduled").length}</strong><small>prontos para publicar</small></article>
      <article><span>Visualizações registradas</span><strong>{views.toLocaleString("pt-BR")}</strong><small>métricas informadas</small></article>
    </section>
    <section className="panel"><div className="panel-title"><div><span>PRÓXIMA AÇÃO</span><h2>{nextPlan?.title ?? "Comece sua primeira ideia"}</h2></div>
      {nextPlan?.status === "idea" && <button className="primary-button" onClick={() => onGenerate(nextPlan)}><Sparkles size={15}/> Gerar roteiro</button>}</div>
      {nextPlan ? <div className="next-content"><div className={`platform-mark ${nextPlan.platform}`}>{nextPlan.platform.slice(0, 1).toUpperCase()}</div>
        <div><strong>{statusLabel(nextPlan.status)}</strong><span>{nextPlan.scheduled_for ? formatDate(nextPlan.scheduled_for) : "Ainda sem agendamento"}</span></div><ChevronRight/></div>
        : <EmptyState title="Seu espaço criativo está pronto" text="Capture uma ideia e transforme-a em um roteiro revisável." action="Criar primeira ideia" onAction={onCreate}/>}
    </section>
  </div>;
}

function CalendarView({ groups, onSelect }: { groups: Map<string, ContentPlan[]>; onSelect: (plan: ContentPlan) => void }) {
  const entries = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  return <div className="view-stack"><ViewHeading eyebrow="CALENDÁRIO" title="Seu plano confirmado" subtitle="Somente conteúdos realmente agendados aparecem aqui."/>
    <section className="panel timeline">{entries.length === 0 ? <EmptyState title="Nenhum conteúdo agendado" text="Confirme um roteiro no Estúdio para vê-lo no calendário."/> :
      entries.map(([date, items]) => <div className="timeline-day" key={date}><time>{formatDate(`${date}T12:00:00`, { weekday: "short", day: "2-digit", month: "short" })}</time>
        <div>{items.map((plan) => <button key={plan.id} onClick={() => onSelect(plan)}><span className={`platform-dot ${plan.platform}`}/>
          <strong>{plan.title}</strong><small>{formatDate(plan.scheduled_for, { hour: "2-digit", minute: "2-digit" })} · {plan.platform}</small><ChevronRight size={16}/></button>)}</div>
      </div>)}</section>
  </div>;
}

function ContentView({ plans, selected, onSelect, onCreate, onGenerate }: {
  plans: ContentPlan[]; selected: ContentPlan | null; onSelect: (plan: ContentPlan) => void;
  onCreate: () => void; onGenerate: (plan: ContentPlan) => void;
}) {
  return <div className="view-stack"><ViewHeading eyebrow="ESTÚDIO" title="Conteúdos" subtitle="Ideias, roteiros revisados e publicações no mesmo fluxo."
    action={<button className="primary-button" onClick={onCreate}><Plus size={15}/> Nova ideia</button>}/>
    <section className="content-layout"><div className="content-list panel">{plans.length === 0 ?
      <EmptyState title="Nenhum conteúdo ainda" text="Sua primeira ideia leva menos de um minuto para registrar." action="Criar ideia" onAction={onCreate}/> :
      plans.map((plan) => <button key={plan.id} className={selected?.id === plan.id ? "selected" : ""} onClick={() => onSelect(plan)}>
        <span className={`platform-mark ${plan.platform}`}>{plan.platform.slice(0, 1).toUpperCase()}</span><div><strong>{plan.title}</strong>
          <small>{statusLabel(plan.status)} · {plan.platform}</small></div><ChevronRight size={16}/></button>)}</div>
      <div className="content-detail panel">{selected ? <><span className="status-pill">{statusLabel(selected.status)}</span><h2>{selected.title}</h2>
        <p>{selected.objective || "Sem objetivo informado."}</p><dl><div><dt>Plataforma</dt><dd>{selected.platform}</dd></div>
          <div><dt>Formato</dt><dd>{selected.format || "A definir"}</dd></div><div><dt>Agendamento</dt><dd>{formatDate(selected.scheduled_for)}</dd></div></dl>
        {selected.status === "idea" && <button className="primary-button full" onClick={() => onGenerate(selected)}><Sparkles size={16}/> Gerar roteiro com IA</button>}
        {selected.status === "generating" && <button className="secondary-button full" disabled><LoaderCircle className="spin" size={16}/> Geração em andamento</button>}
        {["review", "scheduled", "ready"].includes(selected.status) && <div className="confirmed-note"><Check size={17}/><span>Este conteúdo já passou pela geração. Abra novamente pelo histórico de versões na próxima iteração.</span></div>}
      </> : <EmptyState title="Selecione um conteúdo" text="Veja detalhes e avance para a próxima etapa."/>}</div>
    </section>
  </div>;
}

function PerformanceView({ plans, publications, onSubmit }: {
  plans: ContentPlan[]; publications: Publication[]; onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const eligible = plans.filter((plan) => ["scheduled", "published"].includes(plan.status));
  return <div className="view-stack"><ViewHeading eyebrow="APRENDIZADO" title="Desempenho" subtitle="Registre resultados reais; o Ritmo não inventa alcance."/>
    <section className="content-layout"><form className="panel product-form" onSubmit={onSubmit}><h2>Registrar publicação</h2>
      <label>Conteúdo<select name="content_plan_id" required defaultValue=""><option value="" disabled>Selecione</option>{eligible.map((plan) => <option key={plan.id} value={plan.id}>{plan.title}</option>)}</select></label>
      <label>Publicado em<input name="published_at" type="datetime-local" required/></label><label>URL<input name="url" type="url" placeholder="https://…"/></label>
      <div className="field-grid"><label>Visualizações<input name="views" type="number" min="0" defaultValue="0"/></label><label>Curtidas<input name="likes" type="number" min="0" defaultValue="0"/></label>
        <label>Comentários<input name="comments" type="number" min="0" defaultValue="0"/></label><label>Salvamentos<input name="saves" type="number" min="0" defaultValue="0"/></label></div>
      <button className="primary-button" disabled={eligible.length === 0}>Salvar resultado</button></form>
      <div className="panel result-list"><h2>Histórico real</h2>{publications.length === 0 ? <EmptyState title="Sem resultados" text="Depois de publicar, registre as métricas aqui."/> :
        publications.map((item) => <article key={item.id}><time>{formatDate(item.published_at)}</time><strong>{Number(item.metrics.views ?? 0).toLocaleString("pt-BR")} visualizações</strong>
          <span>{Number(item.metrics.likes ?? 0)} curtidas · {Number(item.metrics.saves ?? 0)} salvamentos</span></article>)}</div>
    </section></div>;
}

function MemoriesView({ memories, onUpdate }: { memories: Memory[]; onUpdate: (memory: Memory, status: "confirmed" | "rejected" | "archived") => void }) {
  return <div className="view-stack"><ViewHeading eyebrow="SOB SEU CONTROLE" title="Memórias" subtitle="Nada vira contexto durável sem sua revisão."/>
    <section className="panel memory-list">{memories.length === 0 ? <EmptyState title="Nenhuma memória sugerida" text="Converse com o copiloto para que ele identifique preferências úteis."/> :
      memories.map((memory) => <article key={memory.id}><div><span>{memory.category} · {Math.round(memory.confidence * 100)}% confiança</span><p>{memory.content}</p><small>{statusLabel(memory.status)}</small></div>
        <div>{memory.status === "suggested" && <><button className="approve" onClick={() => onUpdate(memory, "confirmed")}><Check size={14}/> Aceitar</button>
          <button onClick={() => onUpdate(memory, "rejected")}><X size={14}/> Rejeitar</button></>}
          {["confirmed", "pinned"].includes(memory.status) && <button onClick={() => onUpdate(memory, "archived")}>Arquivar</button>}</div></article>)}</section>
  </div>;
}

function ContextView({ profile, niche }: { profile: Profile | null; niche: string }) {
  const nicheName = niches.find(([id]) => id === niche)?.[1] ?? "Não definido";
  return <div className="view-stack"><ViewHeading eyebrow="CONTEXTO AUTORIZADO" title="Seu perfil criativo" subtitle="Estas informações orientam planos e roteiros."/>
    <section className="profile-grid"><article className="panel"><Target/><span>Modo de conta</span><strong>{profile?.account_mode ?? "Não definido"}</strong></article>
      <article className="panel"><Lightbulb/><span>Nicho principal</span><strong>{nicheName}</strong></article>
      <article className="panel"><Clock3/><span>Disponibilidade</span><strong>{String(profile?.context?.weekly_hours ?? "—")} h/semana</strong></article>
      <article className="panel"><CircleUserRound/><span>Fuso horário</span><strong>{profile?.timezone ?? "—"}</strong></article></section>
    <div className="panel privacy-note"><Check/><div><strong>Você continua no controle</strong><p>O copiloto consulta somente dados da sua conta protegidos por RLS e memórias confirmadas.</p></div></div>
  </div>;
}

function Onboarding({ profile, onSubmit }: { profile: Profile; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop"><form className="product-modal onboarding-modal" onSubmit={onSubmit}>
    <span className="modal-icon"><Sparkles/></span><p className="eyebrow">SEU PRIMEIRO RITMO</p><h2>Conte um pouco sobre sua criação</h2>
    <p>Quatro respostas bastam. Você poderá aprofundar o contexto depois.</p>
    <label>Como podemos chamar você?<input name="display_name" required minLength={2} defaultValue={profile.display_name ?? ""}/></label>
    <div className="field-grid"><label>Modo de conta<select name="account_mode" defaultValue="professional"><option value="hobby">Hobby</option><option value="professional">Profissional solo</option><option value="team">Equipe / agência</option></select></label>
      <label>Nicho principal<select name="niche_id" required defaultValue=""><option value="" disabled>Selecione</option>{niches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label>Plataforma principal<select name="platform" defaultValue="instagram"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></label>
      <label>Horas disponíveis/semana<input name="weekly_hours" type="number" min="1" max="80" defaultValue="4" required/></label></div>
    <button className="primary-button full">Começar meu ritmo <ChevronRight size={16}/></button>
  </form></div>;
}

function IdeaDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="modal-backdrop"><form className="product-modal" onSubmit={onSubmit}><button type="button" className="modal-close" onClick={onClose}><X/></button>
    <p className="eyebrow">NOVA IDEIA</p><h2>O que você quer criar?</h2><p>Registre a intenção primeiro. A IA entra somente quando você pedir.</p>
    <label>Título<input name="title" required minLength={3} maxLength={200} placeholder="Ex.: 3 erros que atrasam seu conteúdo"/></label>
    <label>Objetivo<textarea name="objective" required maxLength={500} placeholder="O que a pessoa deve aprender, sentir ou fazer?"/></label>
    <div className="field-grid"><label>Plataforma<select name="platform" defaultValue="instagram"><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></label>
      <label>Formato<select name="format" defaultValue="reel"><option value="reel">Reel</option><option value="short-video">Vídeo curto</option><option value="carousel">Carrossel</option><option value="story">Story</option></select></label></div>
    <button className="primary-button full">Salvar ideia</button></form></div>;
}

function StudioDialog({ plan, draft, status, onClose, onSubmit }: {
  plan: ContentPlan; draft: ContentPackage | null; status: string; onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return <div className="modal-backdrop studio-backdrop"><form className="product-modal studio-modal" onSubmit={onSubmit}><button type="button" className="modal-close" onClick={onClose}><X/></button>
    <p className="eyebrow">ESTÚDIO DE CONTEÚDO</p><h2>{plan.title}</h2><div className="job-status">{draft ? <Check/> : <LoaderCircle className="spin"/>}<span>{status}</span></div>
    {!draft ? <div className="generation-wait"><Sparkles/><strong>Preparando uma proposta estruturada</strong><span>Sua ideia original foi preservada.</span></div> :
      <><section className="draft-section"><span>GANCHOS</span>{draft.hooks.map((hook) => <p key={hook}>{hook}</p>)}</section>
        <section className="scene-list"><span>CENAS</span>{draft.scenes.map((scene) => <article key={scene.order}><i>{scene.order}</i><div><strong>{scene.visual}</strong><p>{scene.speech}</p><small>{scene.duration_seconds}s</small></div></article>)}</section>
        <label>Legenda<textarea name="caption" required defaultValue={draft.caption}/></label><label>CTA<input name="cta" required defaultValue={draft.cta}/></label>
        <label>Agendar para<input name="scheduled_for" type="datetime-local" required min={new Date().toISOString().slice(0, 16)}/></label>
        <div className="human-confirmation"><Check/><span>Ao confirmar, você cria uma versão imutável e aprova o agendamento.</span></div>
        <button className="primary-button full">Confirmar versão e agendar</button></>}
  </form></div>;
}

function ViewHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) {
  return <header className="view-heading"><div><span>{eyebrow}</span><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>;
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="product-empty"><FileText/><strong>{title}</strong><span>{text}</span>{action && onAction && <button className="secondary-button" onClick={onAction}>{action}</button>}</div>;
}
