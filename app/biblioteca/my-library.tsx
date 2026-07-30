"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase-browser";

type OwnPost = { id: string; slug: string; editorial_status: string; withdrawn_at: string | null };
type Submission = { post_id: string; source_content_version_id: string; title: string; summary: string; usage_notes: string | null;
  niches: string[]; tags: string[]; creative_type: string; format: string; platform: string; objective: string; version: number };
type Saved = { id: string; slug: string; title: string; summary: string };

export function MyLibrary() {
  const [own, setOwn] = useState<Array<OwnPost & { submission?: Submission }>>([]);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [notice, setNotice] = useState("");
  const keys = useRef<Record<string, string>>({});
  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session) { location.href = "/login?return_to=/biblioteca"; return; }
    const { data: profile } = await supabase.from("public_creator_profiles").select("id").eq("user_id", auth.session.user.id).maybeSingle();
    const { data: posts } = profile ? await supabase.from("community_posts").select("id,slug,editorial_status,withdrawn_at").eq("author_profile_id", profile.id) : { data: [] };
    const postIds = (posts ?? []).map((post) => post.id);
    const { data: submissions } = postIds.length ? await supabase.from("community_submissions")
      .select("post_id,source_content_version_id,title,summary,usage_notes,niches,tags,creative_type,format,platform,objective,version")
      .in("post_id", postIds).order("version", { ascending: false }) : { data: [] };
    const latest = new Map<string, Submission>();
    for (const row of (submissions ?? []) as Submission[]) if (!latest.has(row.post_id)) latest.set(row.post_id, row);
    setOwn(((posts ?? []) as OwnPost[]).map((post) => ({ ...post, submission: latest.get(post.id) })));
    const { data: saves } = await supabase.from("community_post_saves").select("post_id");
    const saveIds = (saves ?? []).map((save) => save.post_id);
    const { data: library } = saveIds.length ? await supabase.from("community_library").select("id,slug,title,summary").in("id", saveIds) : { data: [] };
    setSaved((library ?? []) as Saved[]);
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function withdraw(postId: string) {
    if (!supabase || !confirm("Retirar esta publicação do blog público?")) return;
    const { error } = await supabase.rpc("withdraw_community_post", { p_post_id: postId });
    setNotice(error ? "Não foi possível retirar a publicação." : "Publicação retirada.");
    if (!error) await load();
  }
  async function resubmit(event: FormEvent<HTMLFormElement>, postId: string, source?: Submission) {
    event.preventDefault();
    if (!supabase || !source) return;
    keys.current[postId] ??= crypto.randomUUID();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.rpc("submit_community_content", {
      p_source_content_version_id: source.source_content_version_id, p_title: String(form.get("title")),
      p_summary: String(form.get("summary")), p_usage_notes: source.usage_notes ?? "", p_niches: source.niches,
      p_tags: source.tags, p_creative_type: source.creative_type, p_format: source.format, p_platform: source.platform,
      p_objective: source.objective, p_rights_confirmed: true, p_adaptation_license_accepted: true,
      p_post_id: postId, p_idempotency_key: keys.current[postId],
    });
    if (error) { setNotice("Não foi possível enviar a nova versão."); return; }
    delete keys.current[postId];
    setNotice("Nova versão enviada para moderação.");
    await load();
  }
  return <div className="my-library">
    <header><div><span>SEU ACERVO</span><h1>Minha biblioteca</h1><p>Gerencie publicações e encontre os roteiros que você salvou.</p></div><Link href="/blog">Explorar biblioteca</Link></header>
    {notice && <p className="moderation-notice" role="status">{notice}</p>}
    <section><h2>Minhas publicações</h2>{own.length === 0 ? <p className="my-library-empty">Você ainda não compartilhou um roteiro.</p> :
      own.map((post) => <article key={post.id}><div><strong>{post.submission?.title ?? "Publicação"}</strong><span>{post.editorial_status}</span></div>
        <form onSubmit={(event) => void resubmit(event, post.id, post.submission)}><label>Título<input name="title" required defaultValue={post.submission?.title}/></label>
          <label>Resumo<textarea name="summary" required minLength={20} defaultValue={post.submission?.summary}/></label>
          <button disabled={!post.submission}>Enviar nova versão</button></form>
        {!post.withdrawn_at && <button className="danger" onClick={() => void withdraw(post.id)}>Retirar do blog</button>}</article>)}</section>
    <section><h2>Roteiros salvos</h2><div className="saved-grid">{saved.length === 0 ? <p className="my-library-empty">Nenhum roteiro salvo.</p> :
      saved.map((post) => <Link href={`/blog/${post.slug}`} key={post.id}><strong>{post.title}</strong><span>{post.summary}</span></Link>)}</div></section>
  </div>;
}
