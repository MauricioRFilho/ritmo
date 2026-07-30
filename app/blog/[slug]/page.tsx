import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { absoluteUrl, getCommunityPost, plainTextBlocks } from "../../../lib/community";
import { LibraryHeader } from "../library-header";
import { CommunityActions } from "./community-actions";
import "../blog.css";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getCommunityPost(slug);
  if (!post) return { title: "Roteiro não encontrado | Ritmo", robots: { index: false, follow: false } };
  const url = `/blog/${post.slug}`;
  return { title: `${post.title} | Ritmo`, description: post.summary, alternates: { canonical: url },
    openGraph: { title: post.title, description: post.summary, url, type: "article", publishedTime: post.published_at } };
}

export default async function CommunityPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getCommunityPost(slug);
  if (!post) notFound();
  const blocks = plainTextBlocks(post.content);
  const jsonLd = { "@context": "https://schema.org", "@type": "CreativeWork", name: post.title,
    description: post.summary, url: absoluteUrl(`/blog/${post.slug}`), datePublished: post.published_at,
    author: { "@type": "Person", name: post.author_name }, genre: post.creative_type, keywords: [...post.niches, ...post.tags].join(", ") };
  return <main className="library-page"><LibraryHeader/><article className="library-main library-detail">
    <Link className="library-breadcrumb" href="/blog">← Voltar para a biblioteca</Link>
    <div className="library-card-badges"><span className={`library-badge ${post.origin === "official" ? "official" : ""}`}>{post.origin === "official" ? "Ritmo oficial" : "Comunidade"}</span><span className="library-badge">{post.format}</span></div>
    <h1>{post.title}</h1><p className="library-lead">{post.summary}</p>
    <div className="library-meta"><span>Por {post.author_name}{post.author_handle ? ` · @${post.author_handle}` : ""}</span><span>{post.platform}</span>{post.duration_seconds && <span>{post.duration_seconds}s</span>}<span>Versão {post.template_version}</span></div>
    <section className="library-content"><h2>Roteiro estruturado</h2>{blocks.map((block, index) => <p className="library-block" key={`${index}-${block}`}>{block}</p>)}</section>
    <CommunityActions postId={post.community_post_id} templateId={post.template_id} templateVersion={post.template_version} origin={post.origin}/>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}/>
  </article></main>;
}
