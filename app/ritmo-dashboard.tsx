"use client";

import {
  BarChart3, CalendarDays, Check, ChevronRight, CircleUserRound,
  FileText, Home, Lightbulb, LoaderCircle, LogOut, Menu, Plus, RefreshCw,
  Send, Sparkles, Video, X,
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
type ContentTaxonomyV2 = { schema_version: 2; primary_niche_id: string; secondary_niche_ids: string[]; custom_niches: string[] };
type CreatorContext = {
  content_pillars: string; audience: string; audience_needs: string; audience_interests: string; audience_region: string;
  style: string; monetization: string; objectives: string; preferred_cta: string; priority_metrics: string;
  operation: string; weekly_hours: number; publishing_frequency: string; resources: string; restrictions: string; platforms: Platform[];
};
type PlatformProfile = { platform: Platform };
type SaveState = "idle" | "saving" | "success" | "error";
type ContextSavePayload = { displayName: string; accountMode: AccountMode; taxonomy: ContentTaxonomyV2; context: CreatorContext };

const navigation = [
  { id: "today" as View, label: "Hoje", icon: Home },
  { id: "calendar" as View, label: "Calendário", icon: CalendarDays },
  { id: "content" as View, label: "Conteúdos", icon: Video },
  { id: "performance" as View, label: "Desempenho", icon: BarChart3 },
  { id: "memories" as View, label: "Memórias", icon: Lightbulb },
  { id: "context" as View, label: "Meu contexto", icon: CircleUserRound },
];

const niches = [
  ["humor-comedia", "Humor / Comédia"], ["influencer-geral", "Lifestyle"], ["beleza", "Beleza"], ["moda", "Moda"],
  ["culinaria", "Culinária"], ["saude-bem-estar", "Saúde / Bem-estar"], ["fitness", "Fitness"], ["esporte-geral", "Esportes"],
  ["corrida", "Corrida"], ["games", "Games"], ["tecnologia", "Tecnologia"], ["educacao", "Educação"], ["financas", "Finanças"],
  ["negocios", "Negócios"], ["marketing", "Marketing"], ["carreira", "Carreira"], ["relacionamentos", "Relacionamentos"],
  ["familia", "Família"], ["viagens", "Viagens"], ["musica", "Música"], ["arte-cultura", "Arte / Cultura"], ["pets", "Pets"],
  ["casa-decoracao", "Casa / Decoração"], ["diy", "DIY"], ["sustentabilidade", "Sustentabilidade"],
  ["noticias-opiniao", "Notícias / Opinião"], ["fe-espiritualidade", "Fé / Espiritualidade"], ["entretenimento", "Entretenimento"],
  ["automotivo", "Automotivo"], ["agro", "Agro"], ["juridico", "Jurídico"], ["imobiliario", "Imobiliário"], ["outros", "Outros"],
] as const;

const legacyNicheAliases: Record<string, string> = { "maquiagem-beauty": "beleza", "negocios-educacao-financeira": "negocios" };
const emptyContext: CreatorContext = {
  content_pillars: "", audience: "", audience_needs: "", audience_interests: "", audience_region: "", style: "", monetization: "",
  objectives: "", preferred_cta: "", priority_metrics: "", operation: "", weekly_hours: 4, publishing_frequency: "", resources: "",
  restrictions: "", platforms: ["instagram"],
};

function uniqueStrings(values: unknown[]) { return [...new Set(values.map((value) => String(value).trim()).filter(Boolean))]; }
function normalizeNicheId(value: unknown) { const id = String(value ?? ""); return legacyNicheAliases[id] ?? id; }
function normalizeTaxonomy(value: unknown, fallbackNiche: unknown): ContentTaxonomyV2 {
  const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const primary = normalizeNicheId(raw.primary_niche_id ?? raw.niche_id ?? fallbackNiche);
  return { schema_version: 2, primary_niche_id: primary,
    secondary_niche_ids: uniqueStrings(Array.isArray(raw.secondary_niche_ids) ? raw.secondary_niche_ids : []).map(normalizeNicheId).filter((id) => id !== primary),
    custom_niches: uniqueStrings(Array.isArray(raw.custom_niches) ? raw.custom_niches : []) };
}
function normalizeCreatorContext(value: Record<string, unknown> | null | undefined, platforms: Platform[]): CreatorContext {
  const raw = value ?? {}; const text = (key: string) => typeof raw[key] === "string" ? String(raw[key]) : "";
  const storedPlatforms = Array.isArray(raw.platforms) ? raw.platforms : platforms;
  return { ...emptyContext, content_pillars: text("content_pillars"), audience: text("audience"), audience_needs: text("audience_needs"),
    audience_interests: text("audience_interests"), audience_region: text("audience_region"), style: text("style"), monetization: text("monetization"),
    objectives: text("objectives"), preferred_cta: text("preferred_cta"), priority_metrics: text("priority_metrics"), operation: text("operation"),
    weekly_hours: Number(raw.weekly_hours) || 4, publishing_frequency: text("publishing_frequency"), resources: text("resources"),
    restrictions: text("restrictions"), platforms: uniqueStrings(storedPlatforms).filter((item): item is Platform => item === "instagram" || item === "tiktok") };
}
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
  const [taxonomy, setTaxonomy] = useState<ContentTaxonomyV2>(() => normalizeTaxonomy({}, ""));
  const [platformProfiles, setPlatformProfiles] = useState<PlatformProfile[]>([]);
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
    const [profileResult, plansResult, preferencesResult, memoriesResult, publicationsResult, platformsResult] = await Promise.all([
      db.from("profiles").select("*").eq("user_id", userId).single(),
      db.from("content_plans").select("*").order("scheduled_for", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      db.from("creator_preferences").select("niche_id,value").eq("category", "content_taxonomy").maybeSingle(),
      db.from("creator_memories").select("id,category,content,status,confidence").order("created_at", { ascending: false }),
      db.from("publication_results").select("id,content_plan_id,metrics,published_at").order("published_at", { ascending: false }),
      db.from("platform_profiles").select("platform"),
    ]);
    if (profileResult.error) {
      setError("Não foi possível carregar seu perfil.");
    } else {
      setProfile(profileResult.data as Profile);
    }
    setPlans((plansResult.data ?? []) as ContentPlan[]);
    const loadedTaxonomy = normalizeTaxonomy(preferencesResult.data?.value, preferencesResult.data?.niche_id);
    setTaxonomy(loadedTaxonomy);
    setNiche(loadedTaxonomy.primary_niche_id);
    setPlatformProfiles((platformsResult.data ?? []) as PlatformProfile[]);
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
    const selectedNiche = normalizeNicheId(form.get("niche_id"));
    const platform = String(form.get("platform")) as Platform;
    const weeklyHours = Number(form.get("weekly_hours"));
    const nextTaxonomy = normalizeTaxonomy({ primary_niche_id: selectedNiche }, selectedNiche);
    const nextContext = { ...profile.context, weekly_hours: weeklyHours, platforms: [platform] };
    setNotice("Salvando seu contexto..."); setError("");
    const { error: profileError } = await db.from("profiles").update({ display_name: displayName, account_mode: accountMode,
      onboarding_completed: true, context: nextContext, updated_at: new Date().toISOString() }).eq("user_id", profile.user_id);
    const { error: preferenceError } = await db.from("creator_preferences").upsert({ user_id: profile.user_id, category: "content_taxonomy",
      niche_id: selectedNiche, value: nextTaxonomy, updated_at: new Date().toISOString() }, { onConflict: "user_id,category" });
    const { error: platformError } = await db.from("platform_profiles").upsert({ user_id: profile.user_id, platform }, { onConflict: "user_id,platform" });
    if (profileError || preferenceError || platformError) {
      setNotice(""); setError("Não foi possível concluir o onboarding. Revise os dados e tente novamente."); return;
    }
    setNotice("Contexto salvo."); await loadData();
  }

  async function saveCreatorContext(payload: ContextSavePayload) {
    const db = supabase;
    if (!db || !profile) return { ok: false, message: "Sua sessão não está disponível." };
    const updatedAt = new Date().toISOString();
    const cleanTaxonomy = normalizeTaxonomy(payload.taxonomy, payload.taxonomy.primary_niche_id);
    const cleanContext: CreatorContext = { ...payload.context,
      platforms: uniqueStrings(payload.context.platforms).filter((item): item is Platform => item === "instagram" || item === "tiktok"),
      weekly_hours: Math.max(1, Math.min(80, Number(payload.context.weekly_hours) || 1)),
    };
    if (!cleanTaxonomy.primary_niche_id || cleanContext.platforms.length === 0) {
      return { ok: false, message: "Defina um nicho principal e ao menos uma plataforma." };
    }
    const profileResult = await db.from("profiles").update({ display_name: payload.displayName.trim(), account_mode: payload.accountMode,
      context: cleanContext, updated_at: updatedAt }).eq("user_id", profile.user_id);
    const preferenceResult = await db.from("creator_preferences").upsert({ user_id: profile.user_id, category: "content_taxonomy",
      niche_id: cleanTaxonomy.primary_niche_id, value: cleanTaxonomy, updated_at: updatedAt }, { onConflict: "user_id,category" });
    const platformWrites = await Promise.all(cleanContext.platforms.map((platform) => db.from("platform_profiles").upsert({
      user_id: profile.user_id, platform, updated_at: updatedAt,
    }, { onConflict: "user_id,platform" })));
    const platformDeletes = await Promise.all((["instagram", "tiktok"] as Platform[]).filter((platform) => !cleanContext.platforms.includes(platform))
      .map((platform) => db.from("platform_profiles").delete().eq("user_id", profile.user_id).eq("platform", platform)));
    const failed = profileResult.error || preferenceResult.error || platformWrites.some((item) => item.error) || platformDeletes.some((item) => item.error);
    if (failed) return { ok: false, message: "Não foi possível salvar tudo. Seus campos continuam na tela para tentar novamente." };
    setProfile((current) => current ? { ...current, display_name: payload.displayName.trim(), account_mode: payload.accountMode, context: cleanContext } : current);
    setTaxonomy(cleanTaxonomy); setNiche(cleanTaxonomy.primary_niche_id); setPlatformProfiles(cleanContext.platforms.map((platform) => ({ platform })));
    setNotice(""); setError("");
    return { ok: true, message: `Contexto atualizado em ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(updatedAt))}.` };
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
          content_taxonomy: taxonomy,
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
      {view === "context" && <ContextView profile={profile} taxonomy={taxonomy} platforms={platformProfiles.map((item) => item.platform)} onSave={saveCreatorContext}/>}
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

function ContextView({ profile, taxonomy, platforms, onSave }: {
  profile: Profile | null; taxonomy: ContentTaxonomyV2; platforms: Platform[];
  onSave: (payload: ContextSavePayload) => Promise<{ ok: boolean; message: string }>;
}) {
  const initialContext = normalizeCreatorContext(profile?.context, platforms);
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [accountMode, setAccountMode] = useState<AccountMode>(profile?.account_mode ?? "professional");
  const [draftTaxonomy, setDraftTaxonomy] = useState<ContentTaxonomyV2>(taxonomy);
  const [customNicheInput, setCustomNicheInput] = useState(taxonomy.custom_niches.join(", "));
  const [draftContext, setDraftContext] = useState<CreatorContext>(initialContext);
  const initialSnapshot = JSON.stringify({ displayName: profile?.display_name ?? "", accountMode: profile?.account_mode ?? "professional", taxonomy, context: initialContext });
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState("Contexto carregado. Alterações só entram no copiloto depois de salvar.");
  const currentSnapshot = JSON.stringify({ displayName, accountMode, taxonomy: draftTaxonomy, context: draftContext });
  const dirty = currentSnapshot !== savedSnapshot;
  const setContextField = <K extends keyof CreatorContext>(key: K, value: CreatorContext[K]) => {
    setDraftContext((current) => ({ ...current, [key]: value })); setSaveState("idle");
  };
  const toggleSecondary = (id: string) => setDraftTaxonomy((current) => ({ ...current,
    secondary_niche_ids: current.secondary_niche_ids.includes(id) ? current.secondary_niche_ids.filter((item) => item !== id)
      : uniqueStrings([...current.secondary_niche_ids, id]).filter((item) => item !== current.primary_niche_id),
  }));
  const togglePlatform = (platform: Platform) => setContextField("platforms", draftContext.platforms.includes(platform)
    ? draftContext.platforms.filter((item) => item !== platform) : [...draftContext.platforms, platform]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaveState("saving"); setSaveMessage("Salvando seu contexto autorizado…");
    const result = await onSave({ displayName, accountMode, taxonomy: normalizeTaxonomy(draftTaxonomy, draftTaxonomy.primary_niche_id), context: draftContext });
    if (result.ok) { setSavedSnapshot(currentSnapshot); setSaveState("success"); } else setSaveState("error");
    setSaveMessage(result.message);
  }
  return <div className="view-stack"><ViewHeading eyebrow="CONTEXTO AUTORIZADO" title="Seu perfil criativo"
    subtitle="Edite o que orienta seus próximos planos, conversas e roteiros. Conteúdos já confirmados não mudam."/>
    <form className="context-editor" onSubmit={submit}>
      <section><header><span>1</span><div><h3>Perfil</h3><p>Como você cria e organiza sua conta.</p></div></header>
        <div className="field-grid"><label>Nome<input value={displayName} onChange={(event) => { setDisplayName(event.target.value); setSaveState("idle"); }} required minLength={2}/></label>
          <label>Modo de conta<select value={accountMode} onChange={(event) => { setAccountMode(event.target.value as AccountMode); setSaveState("idle"); }}>
            <option value="hobby">Hobby</option><option value="professional">Profissional solo</option><option value="team">Equipe / agência</option></select></label></div></section>
      <section><header><span>2</span><div><h3>Conteúdo</h3><p>Nichos são somente os temas do conteúdo; estilo e monetização ficam livres abaixo.</p></div></header>
        <label>Nicho principal<select value={draftTaxonomy.primary_niche_id} required onChange={(event) => { const primary = event.target.value;
          setDraftTaxonomy((current) => ({ ...current, primary_niche_id: primary, secondary_niche_ids: current.secondary_niche_ids.filter((id) => id !== primary) })); setSaveState("idle"); }}>
          <option value="" disabled>Selecione</option>{niches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <fieldset className="niche-picker"><legend>Nichos secundários <small>opcional</small></legend><div>{niches.filter(([id]) => id !== draftTaxonomy.primary_niche_id && id !== "outros").map(([id, name]) =>
          <label key={id} className={draftTaxonomy.secondary_niche_ids.includes(id) ? "selected" : ""}><input type="checkbox" checked={draftTaxonomy.secondary_niche_ids.includes(id)} onChange={() => { toggleSecondary(id); setSaveState("idle"); }}/><span>{name}</span></label>)}</div></fieldset>
        <label>Outros temas personalizados<textarea value={customNicheInput} onChange={(event) => { setCustomNicheInput(event.target.value); setDraftTaxonomy((current) => ({ ...current, custom_niches: uniqueStrings(event.target.value.split(/[,\n]/)) })); setSaveState("idle"); }} placeholder="Ex.: cultura geek local, maternidade atípica (separe por vírgulas)"/></label>
        <label>Pilares e assuntos recorrentes<textarea value={draftContext.content_pillars} onChange={(event) => setContextField("content_pillars", event.target.value)} placeholder="Quais assuntos você quer abordar com frequência?"/></label></section>
      <section><header><span>3</span><div><h3>Público</h3><p>Quem você quer alcançar e o que essas pessoas precisam.</p></div></header>
        <label>Descrição do público<textarea value={draftContext.audience} onChange={(event) => setContextField("audience", event.target.value)} placeholder="Idade, momento de vida, profissão ou comportamento…"/></label>
        <div className="field-grid"><label>Necessidades<textarea value={draftContext.audience_needs} onChange={(event) => setContextField("audience_needs", event.target.value)}/></label>
          <label>Interesses<textarea value={draftContext.audience_interests} onChange={(event) => setContextField("audience_interests", event.target.value)}/></label></div>
        <label>Região e contexto cultural<input value={draftContext.audience_region} onChange={(event) => setContextField("audience_region", event.target.value)} placeholder="Ex.: Brasil, interior de SP, público lusófono"/></label></section>
      <section><header><span>4</span><div><h3>Estilo</h3><p>Descreva com liberdade sua linguagem, personalidade e limites.</p></div></header>
        <label>Como seu conteúdo deve soar<textarea value={draftContext.style} onChange={(event) => setContextField("style", event.target.value)} placeholder="Ex.: humor rápido, direto, acolhedor, sem palavrões; referências que combinam e temas que devem ser evitados."/></label></section>
      <section><header><span>5</span><div><h3>Monetização</h3><p>Explique seu modelo atual ou desejado — inclusive se ainda não monetiza.</p></div></header>
        <label>Como você ganha ou pretende ganhar com o conteúdo<textarea value={draftContext.monetization} onChange={(event) => setContextField("monetization", event.target.value)} placeholder="Ex.: afiliados, produtos próprios, serviços, vendas, patrocínios ou sem monetização por enquanto."/></label></section>
      <section><header><span>6</span><div><h3>Objetivos</h3><p>Resultados esperados e sinais que mostram progresso.</p></div></header>
        <label>Resultado esperado<textarea value={draftContext.objectives} onChange={(event) => setContextField("objectives", event.target.value)} placeholder="O que você quer conquistar com o conteúdo?"/></label>
        <div className="field-grid"><label>CTA preferencial<input value={draftContext.preferred_cta} onChange={(event) => setContextField("preferred_cta", event.target.value)} placeholder="Ex.: comentar, salvar, comprar"/></label>
          <label>Métricas prioritárias<input value={draftContext.priority_metrics} onChange={(event) => setContextField("priority_metrics", event.target.value)} placeholder="Ex.: vendas, alcance, salvamentos"/></label></div></section>
      <section><header><span>7</span><div><h3>Operação</h3><p>Sua rotina, capacidade, recursos e restrições reais.</p></div></header>
        <fieldset className="platform-picker"><legend>Plataformas <small>selecione ao menos uma</small></legend><div>{(["instagram", "tiktok"] as Platform[]).map((platform) =>
          <label key={platform} className={draftContext.platforms.includes(platform) ? "selected" : ""}><input type="checkbox" checked={draftContext.platforms.includes(platform)} onChange={() => togglePlatform(platform)}/><span>{platform}</span></label>)}</div></fieldset>
        <div className="field-grid"><label>Horas por semana<input type="number" min="1" max="80" value={draftContext.weekly_hours} onChange={(event) => setContextField("weekly_hours", Number(event.target.value))} required/></label>
          <label>Frequência desejada<input value={draftContext.publishing_frequency} onChange={(event) => setContextField("publishing_frequency", event.target.value)} placeholder="Ex.: 3 vezes por semana"/></label></div>
        <label>Como você trabalha<textarea value={draftContext.operation} onChange={(event) => setContextField("operation", event.target.value)} placeholder="Equipe, fluxo de aprovação, horários ou outras características da rotina."/></label>
        <div className="field-grid"><label>Recursos disponíveis<textarea value={draftContext.resources} onChange={(event) => setContextField("resources", event.target.value)} placeholder="Equipamentos, pessoas, locais…"/></label>
          <label>Restrições<textarea value={draftContext.restrictions} onChange={(event) => setContextField("restrictions", event.target.value)} placeholder="Tempo, orçamento, temas proibidos…"/></label></div></section>
      <footer className="context-actions"><div className={`context-save-state ${saveState}`} role="status" aria-live="polite">
        <strong>{saveState === "saving" ? "Salvando…" : dirty ? "Alterações não salvas" : saveState === "success" ? "Contexto atualizado" : saveState === "error" ? "Não foi possível salvar" : "Contexto confirmado"}</strong>
        <span>{dirty && saveState !== "saving" ? "O copiloto ainda usa a última versão salva." : saveMessage}</span></div>
        <button className="primary-button" disabled={!dirty || saveState === "saving"}>{saveState === "saving" ? <LoaderCircle className="spin"/> : <Check/>} Salvar contexto</button></footer>
    </form>
    <div className="panel privacy-note"><Check/><div><strong>Você continua no controle</strong><p>O novo contexto vale apenas para futuras conversas e gerações. Histórico e versões confirmadas permanecem imutáveis.</p></div></div>
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
