"use client";

import { ArrowRight, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { hasSupabaseConfig, supabase } from "../../lib/supabase-browser";

export default function LoginPage() {
  const [mode, setMode] = useState<"login"|"signup"|"reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setStatus("Configure as chaves do Supabase para ativar o acesso."); return; }
    if (mode === "signup" && !accepted) { setStatus("Aceite os termos para criar sua conta."); return; }
    setLoading(true); setStatus("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
        if (error) throw error;
        setStatus("Enviamos o link de recuperação para seu e-mail.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { terms_accepted_at: new Date().toISOString() } } });
        if (error) throw error;
        setStatus("Conta criada. Confirme seu e-mail para continuar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = "/";
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally { setLoading(false); }
  }

  async function google() {
    if (!supabase) { setStatus("Configure as chaves do Supabase para ativar o Google."); return; }
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin } });
  }

  return <main className="auth-page">
    <section className="auth-story">
      <Link className="auth-brand" href="/"><span><Sparkles size={18}/></span>ritmo</Link>
      <div>
        <span className="auth-eyebrow">SEU CONTEÚDO, NO SEU RITMO</span>
        <h1>Um especialista que<br/>cresce junto com você.</h1>
        <p>Planeje uma rotina de conteúdo possível, receba roteiros com o que você já tem e transforme seus resultados em aprendizado.</p>
        <ul><li><Check/>Planejamento que respeita sua rotina</li><li><Check/>Memória que você controla</li><li><Check/>Roteiros prontos para gravar</li></ul>
      </div>
      <small>Feito para criadores reais, não para rotinas perfeitas.</small>
    </section>
    <section className="auth-form-wrap">
      <form className="auth-form" onSubmit={submit}>
        <span className="mobile-auth-brand"><Sparkles size={17}/> ritmo</span>
        <h2>{mode === "login" ? "Que bom ter você de volta" : mode === "signup" ? "Comece a criar com propósito" : "Recupere seu acesso"}</h2>
        <p>{mode === "login" ? "Entre para continuar de onde parou." : mode === "signup" ? "Crie sua conta gratuita. Sem cartão." : "Enviaremos um link seguro para seu e-mail."}</p>
        {mode !== "reset" && <button type="button" className="google-button" onClick={google}><b>G</b> Continuar com Google</button>}
        {mode !== "reset" && <div className="auth-divider"><span>ou continue com e-mail</span></div>}
        <label>E-mail<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@exemplo.com"/></label>
        {mode !== "reset" && <label>Senha<div className="password-field"><input type={showPassword?"text":"password"} required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Mínimo de 8 caracteres"/><button type="button" onClick={()=>setShowPassword(!showPassword)} aria-label="Mostrar senha">{showPassword?<EyeOff/>:<Eye/>}</button></div></label>}
        {mode === "login" && <button className="forgot" type="button" onClick={()=>setMode("reset")}>Esqueci minha senha</button>}
        {mode === "signup" && <label className="terms"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label>}
        {status && <div className={`auth-status ${!hasSupabaseConfig ? "demo" : ""}`}>{status}</div>}
        <button className="auth-submit" disabled={loading}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar minha conta" : "Enviar link"}<ArrowRight size={17}/></button>
        <div className="auth-switch">
          {mode === "login" ? <>Ainda não tem conta? <button type="button" onClick={()=>setMode("signup")}>Criar gratuitamente</button></> :
           <>Já tem uma conta? <button type="button" onClick={()=>setMode("login")}>Entrar</button></>}
        </div>
      </form>
    </section>
  </main>;
}
