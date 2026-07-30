import Link from "next/link";

export function LibraryHeader() {
  return <header className="library-header">
    <Link className="library-brand" href="/blog"><i>✦</i> ritmo</Link>
    <nav className="library-nav" aria-label="Navegação pública">
      <Link href="/blog">Biblioteca</Link>
      <Link className="library-login" href="/login?return_to=/blog">Entrar para criar</Link>
    </nav>
  </header>;
}
