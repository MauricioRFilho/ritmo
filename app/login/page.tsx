"use client";

import { ArrowRight, Check, Eye, EyeOff, Sparkles } from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { hasSupabaseConfig, supabase } from "../../lib/supabase-browser";

type AuthMode = "login" | "signup" | "reset" | "update";

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) { setStatus("Configure as chaves do Supabase para ativar o acesso."); return; }
    if (mode === "signup" && !accepted) { setStatus("Aceite os termos para criar sua conta."); return; }
    setLoading(true);
    setStatus("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
        if (error) throw error;
        setStatus("Enviamos o link de recuperação para seu e-mail.");
      } else if (mode === "update") {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        setStatus("Senha atualizada. Redirecionando...");
        setTimeout(() => { location.href = "/"; }, 700);
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: name.trim(), terms_accepted_at: new Date().toISOString() } },
        });
        if (error) throw error;
        if (data.session) location.href = "/";
        else setStatus("Conta criada. Confira seu e-mail para confirmar o acesso.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        location.href = "/";
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível continuar.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? "Que bom ter você de volta" : mode === "signup" ? "Comece a criar com propósito" : mode === "update" ? "Crie uma nova senha" : "Recupere seu acesso";
  const subtitle = mode === "login" ? "Entre para continuar de onde parou." : mode === "signup" ? "Crie sua conta gratuita. Sem cartão." : mode === "update" ? "Escolha uma senha segura para voltar ao seu ritmo." : "Enviaremos um link seguro para seu e-mail.";
  const submitLabel = mode === "login" ? "Entrar" : mode === "signup" ? "Criar minha conta" : mode === "update" ? "Salvar nova senha" : "Enviar link";

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
        <h2>{title}</h2>
        <p>{subtitle}</p>
        {mode === "signup" && <label>Como podemos chamar você?<input type="text" required minLength={2} maxLength={80} value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome"/></label>}
        {mode !== "update" && <label>E-mail<input type="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="voce@exemplo.com"/></label>}
        {mode !== "reset" && <label>{mode === "update" ? "Nova senha" : "Senha"}<div className="password-field"><input type={showPassword ? "text" : "password"} required minLength={8} value={password} onChange={event => setPassword(event.target.value)} placeholder="Mínimo de 8 caracteres"/><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Mostrar senha">{showPassword ? <EyeOff/> : <Eye/>}</button></div></label>}
        {mode === "login" && <button className="forgot" type="button" onClick={() => setMode("reset")}>Esqueci minha senha</button>}
        {mode === "signup" && <label className="terms"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)}/><span>Li e aceito os Termos de Uso e a Política de Privacidade.</span></label>}
        {mode === "login" && <div className="auth-note"><Sparkles size={14}/><span>Seu contexto e seus planos ficam protegidos na sua conta Ritmo.</span></div>}
        {status && <div className={`auth-status ${!hasSupabaseConfig ? "demo" : ""}`}>{status}</div>}
        <button className="auth-submit" disabled={loading}>{loading ? "Aguarde..." : submitLabel}<ArrowRight size={17}/></button>
        <div className="auth-switch">
          {mode === "login" ? <>Ainda não tem conta? <button type="button" onClick={() => setMode("signup")}>Criar gratuitamente</button></> :
           mode === "update" ? null : <>Já tem uma conta? <button type="button" onClick={() => setMode("login")}>Entrar</button></>}
        </div>
      </form>
    </section>
  </main>;
}
