"use client";

import {
  BarChart3, Bell, CalendarDays, ChevronLeft, ChevronRight, CircleUserRound,
  Clock3, FileText, Home, Lightbulb, Menu, MoreHorizontal,
  PackageOpen, Plus, Search, Settings, Sparkles, Target, Video, X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { hasSupabaseConfig, supabase } from "../lib/supabase-browser";

type Platform = "instagram" | "tiktok";
type CalendarItem = { day: number; title: string; time: string; platform: Platform; status: string };

const nav = [
  { label: "Hoje", icon: Home, active: true },
  { label: "Calendário", icon: CalendarDays },
  { label: "Minha semana", icon: Target },
  { label: "Conteúdos", icon: Video },
  { label: "Desempenho", icon: BarChart3 },
  { label: "Memórias", icon: Lightbulb },
  { label: "Meu contexto", icon: CircleUserRound },
];

const events: CalendarItem[] = [
  { day: 1, title: "3 erros que atrasam seu negócio", time: "12:30", platform: "instagram", status: "Roteiro pronto" },
  { day: 3, title: "Bastidores do atendimento", time: "19:00", platform: "tiktok", status: "Planejado" },
  { day: 7, title: "Como comecei sem equipamento", time: "18:30", platform: "instagram", status: "Ideia" },
  { day: 9, title: "Rotina real: trabalho + conteúdo", time: "12:00", platform: "tiktok", status: "Planejado" },
  { day: 10, title: "Gravar lote da semana", time: "09:00", platform: "instagram", status: "Tarefa" },
  { day: 14, title: "Antes e depois de um roteiro", time: "18:30", platform: "instagram", status: "Roteiro pronto" },
  { day: 18, title: "Responder dúvidas frequentes", time: "12:30", platform: "tiktok", status: "Ideia" },
  { day: 22, title: "O conselho que eu ignorava", time: "19:00", platform: "instagram", status: "Planejado" },
  { day: 24, title: "Planejar próxima semana", time: "17:30", platform: "tiktok", status: "Hoje" },
  { day: 26, title: "Um dia trabalhando comigo", time: "10:00", platform: "tiktok", status: "Planejado" },
  { day: 29, title: "Resultados honestos do mês", time: "19:00", platform: "instagram", status: "Ideia" },
];

const weekdays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
const days = Array.from({ length: 35 }, (_, i) => i - 1);

export function CreatorDashboard() {
  const [mobileNav, setMobileNav] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [selected, setSelected] = useState(24);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([
    { role: "assistant", text: "Bom dia, Maurício. Sua semana está equilibrada. Hoje, o melhor próximo passo é fechar o plano antes das 18h." }
  ]);
  const selectedEvent = useMemo(() => events.find((event) => event.day === selected), [selected]);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) location.href = "/login";
    });
  }, []);

  function sendMessage() {
    const trimmed = message.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, { role: "user", text: trimmed }, {
      role: "assistant",
      text: "Entendi. Vou considerar isso no seu contexto e preparar uma proposta antes de alterar a agenda."
    }]);
    setMessage("");
  }

  return (
    <main className="app-shell">
      <button className="mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu /></button>
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <div className="brand"><span className="brand-mark"><Sparkles size={17} /></span><span>ritmo</span></div>
        <button className="close-mobile" onClick={() => setMobileNav(false)} aria-label="Fechar menu"><X /></button>
        <nav>
          {nav.map(({ label, icon: Icon, active }) => (
            <button className={active ? "active" : ""} key={label}><Icon size={18}/><span>{label}</span>{label === "Memórias" && <small>3</small>}</button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button><Settings size={18}/><span>Configurações</span></button>
          <div className="profile"><div className="avatar">MS</div><div><strong>Maurício</strong><span>@mauricio.cria</span></div><MoreHorizontal size={18}/></div>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p>Sexta-feira, 24 de julho</p><h1>Seu ritmo de hoje</h1></div>
          <div className="top-actions"><button aria-label="Buscar"><Search size={19}/></button><button aria-label="Notificações"><Bell size={19}/><i /></button><button className="primary"><Sparkles size={16}/> Planejar semana</button></div>
        </header>

        <section className="overview">
          <article className="welcome-card">
            <div><span className="eyebrow"><Sparkles size={13}/> FOCO DO DIA</span><h2>Você não precisa fazer tudo.<br/>Só precisa fazer o próximo.</h2><p>Seu calendário tem <strong>1 tarefa importante</strong> e espaço suficiente para terminá-la com calma.</p></div>
            <div className="week-score"><span>Ritmo da semana</span><strong>82<small>%</small></strong><div><i style={{width:"82%"}} /></div><small>Consistente e sustentável</small></div>
          </article>
          <div className="metrics">
            <article><span>Conteúdos esta semana</span><strong>3 <small>de 4</small></strong><div className="mini-bars"><i/><i/><i/><i className="off"/></div></article>
            <article><span>Meta de alcance</span><strong>18,4 mil</strong><em>↗ 12% este mês</em></article>
            <article><span>Tempo de criação</span><strong>4h 20</strong><em className="neutral">dentro da sua rotina</em></article>
          </div>
        </section>

        <section className="content-grid">
          <article className="calendar-card">
            <div className="section-head">
              <div><span>CALENDÁRIO</span><h2>Julho de 2026</h2></div>
              <div className="calendar-tools"><button><ChevronLeft size={18}/></button><button className="today">Hoje</button><button><ChevronRight size={18}/></button><button className="add"><Plus size={17}/> Novo conteúdo</button></div>
            </div>
            <div className="calendar">
              {weekdays.map(day => <div className="weekday" key={day}>{day}</div>)}
              {days.map((day, index) => {
                const item = events.find(e => e.day === day);
                const isToday = day === 24;
                return <button key={index} className={`calendar-day ${day < 1 || day > 31 ? "muted" : ""} ${selected === day ? "selected" : ""}`} onClick={() => day > 0 && day <= 31 && setSelected(day)}>
                  <span className={isToday ? "today-number" : ""}>{day < 1 ? 29 + day : day > 31 ? day - 31 : day}</span>
                  {item && <div className={`event ${item.platform}`}><i/><strong>{item.time}</strong><p>{item.title}</p></div>}
                </button>;
              })}
            </div>
          </article>

          <aside className="day-panel">
            <div className="panel-head"><div><span>PRÓXIMA AÇÃO</span><h2>{selected === 24 ? "Hoje" : `${selected} de julho`}</h2></div><button><MoreHorizontal/></button></div>
            {selectedEvent ? <>
              <div className="task-time"><Clock3 size={17}/><span>{selectedEvent.time} — 45 min</span></div>
              <h3>{selectedEvent.title}</h3>
              <p className="task-desc">Revise a sugestão do seu copiloto, ajuste os horários e confirme o ritmo que cabe na sua vida.</p>
              <div className="task-meta"><span><FileText size={15}/> {selectedEvent.status}</span><span><PackageOpen size={15}/> Sem material extra</span></div>
              <div className="suggestion"><Sparkles size={17}/><div><strong>Por que agora?</strong><p>Este horário está livre e mantém seu fim de semana leve.</p></div></div>
              <button className="task-button">Abrir atividade <ChevronRight size={17}/></button>
            </> : <div className="empty-day"><CalendarDays/><h3>Um dia mais leve</h3><p>Nenhuma atividade planejada. Aproveite para descansar ou capture uma ideia espontânea.</p><button><Plus size={16}/> Adicionar ideia</button></div>}
            <div className="up-next"><span>DEPOIS DISSO</span><div><i>26</i><p><strong>Gravar “Um dia comigo”</strong><small>Domingo · 10:00</small></p><Video size={18}/></div><div><i>27</i><p><strong>Editar lote da semana</strong><small>Segunda · 18:30</small></p><FileText size={18}/></div></div>
          </aside>
        </section>
      </section>

      <button className={`chat-fab ${chatOpen ? "hidden" : ""}`} onClick={() => setChatOpen(true)} aria-label="Abrir copiloto"><Sparkles/></button>
      <aside className={`copilot ${chatOpen ? "open" : ""}`}>
        <header><div className="ai-avatar"><Sparkles size={18}/></div><div><strong>Seu copiloto</strong><span><i/> Contexto atualizado</span></div><button onClick={() => setChatOpen(false)} aria-label="Fechar copiloto"><X size={18}/></button></header>
        <div className="chat-context"><span><CalendarDays size={13}/> Vendo: calendário de julho</span></div>
        <div className="messages">
          {messages.map((item, i) => <div className={`message ${item.role}`} key={i}>{item.text}</div>)}
          <div className="quick-prompts"><button onClick={() => setMessage("Minha semana ficou mais corrida. Reorganize sem excluir os conteúdos.")}>Minha semana mudou</button><button onClick={() => setMessage("Tenho só 30 minutos hoje. O que priorizo?")}>Tenho só 30 minutos</button></div>
        </div>
        <div className="composer"><textarea value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => {if(e.key === "Enter" && !e.shiftKey){e.preventDefault();sendMessage();}}} placeholder="Converse com seu especialista..." /><button onClick={sendMessage} aria-label="Enviar"><ChevronRight/></button><small>A IA pode errar. Revise antes de confirmar mudanças.</small></div>
      </aside>
      {mobileNav && <button className="overlay" onClick={() => setMobileNav(false)} aria-label="Fechar menu"/>}
    </main>
  );
}
