import type { Metadata } from "next";
import { BlogExplorer } from "./blog-explorer";
import { LibraryHeader } from "./library-header";
import { communityFlags, listCommunityPosts } from "../../lib/community";
import "./blog.css";

export const metadata: Metadata = {
  title: "Biblioteca de roteiros e ideias | Ritmo",
  description: "Descubra roteiros, ideias e templates criativos para adaptar ao seu conteúdo.",
  alternates: { canonical: "/blog" },
  openGraph: { title: "Biblioteca de roteiros e ideias | Ritmo", url: "/blog", type: "website" },
  robots: communityFlags.read ? undefined : { index: false, follow: false },
};

export default async function BlogPage() {
  const posts = await listCommunityPosts();
  return <main className="library-page"><LibraryHeader/><div className="library-main">
    <section className="library-hero"><span className="library-kicker">BIBLIOTECA ABERTA</span>
      <h1>Boas ideias ficam melhores quando circulam.</h1>
      <p>Explore roteiros revisados pela equipe Ritmo e pela comunidade. Escolha uma estrutura e adapte ao seu público, estilo e objetivo.</p></section>
    {communityFlags.read ? <BlogExplorer posts={posts}/> : <section className="library-empty"><h2>Biblioteca em preparação</h2><p>Estamos revisando os primeiros roteiros antes de abrir o catálogo público.</p></section>}
  </div></main>;
}
