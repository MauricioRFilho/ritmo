"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { CommunityPost } from "../../lib/community";

export function BlogExplorer({ posts }: { posts: CommunityPost[] }) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [format, setFormat] = useState("all");
  const [platform, setPlatform] = useState("all");
  const [niche, setNiche] = useState("all");
  const [objective, setObjective] = useState("all");
  const [order, setOrder] = useState("recent");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    const rows = posts.filter((post) =>
      (type === "all" || post.creative_type === type) &&
      (format === "all" || post.format === format) &&
      (platform === "all" || post.platform === platform) &&
      (niche === "all" || post.niches.includes(niche)) &&
      (objective === "all" || post.objective === objective) &&
      (!term || [post.title, post.summary, ...post.tags, ...post.niches].join(" ").toLocaleLowerCase("pt-BR").includes(term)));
    return rows.sort((a, b) => order === "liked" ? b.likes_count - a.likes_count :
      order === "reused" ? b.reuse_count - a.reuse_count :
      new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  }, [posts, search, type, format, platform, niche, objective, order]);
  const values = (pick: (post: CommunityPost) => string[]) => [...new Set(posts.flatMap(pick).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  useEffect(() => { setPage(1); }, [search, type, format, platform, niche, objective, order]);
  const pageSize = 12;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const types = values((post) => [post.creative_type]);
  const formats = values((post) => [post.format]);
  const platforms = values((post) => [post.platform]);
  const niches = values((post) => post.niches);
  const objectives = values((post) => [post.objective]);

  return <>
    <section className="library-controls" aria-label="Filtros da biblioteca">
      <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar roteiro, ideia ou assunto…" aria-label="Buscar"/>
      <select value={niche} onChange={(event) => setNiche(event.target.value)} aria-label="Nicho"><option value="all">Todos os nichos</option>{niches.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={format} onChange={(event) => setFormat(event.target.value)} aria-label="Formato"><option value="all">Todos os formatos</option>{formats.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={platform} onChange={(event) => setPlatform(event.target.value)} aria-label="Plataforma"><option value="all">Todas as plataformas</option>{platforms.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={objective} onChange={(event) => setObjective(event.target.value)} aria-label="Objetivo"><option value="all">Todos os objetivos</option>{objectives.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Tipo criativo"><option value="all">Todos os tipos</option>{types.map((item) => <option key={item}>{item}</option>)}</select>
      <select value={order} onChange={(event) => setOrder(event.target.value)} aria-label="Ordenar"><option value="recent">Mais recentes</option><option value="liked">Mais curtidos</option><option value="reused">Mais reutilizados</option></select>
    </section>
    <p className="library-results" aria-live="polite"><span>{filtered.length} {filtered.length === 1 ? "roteiro encontrado" : "roteiros encontrados"}</span></p>
    <section className="library-grid">{filtered.length ? visible.map((post) =>
      <Link className="library-card" href={`/blog/${post.slug}`} key={`${post.origin}-${post.id}`}>
        <div className="library-card-badges"><span className={`library-badge ${post.origin === "official" ? "official" : ""}`}>{post.origin === "official" ? "Ritmo oficial" : "Comunidade"}</span><span className="library-badge">{post.format}</span></div>
        <h2>{post.title}</h2><p>{post.summary}</p>
        <footer><span><strong>{post.author_name}</strong>{post.platform}</span><span className="library-stats">♡ {post.likes_count} · ↗ {post.reuse_count}</span></footer>
      </Link>) : <div className="library-empty"><h2>Nenhum resultado por aqui</h2><p>Tente remover um filtro ou buscar por outro assunto.</p></div>}</section>
    {filtered.length > pageSize && <nav className="library-pagination" aria-label="Paginação da biblioteca"><button disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button><span aria-live="polite">Página {page} de {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Próxima</button></nav>}
  </>;
}