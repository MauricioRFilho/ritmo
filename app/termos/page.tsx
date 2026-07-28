import Link from "next/link";

export const metadata = { title: "Termos de Uso — Ritmo" };

export default function TermsPage() {
  return <main className="legal-page">
    <article>
      <Link href="/">← Voltar ao Ritmo</Link>
      <h1>Termos de Uso</h1>
      <p>Última atualização: 27 de julho de 2026.</p>
      <h2>1. Serviço</h2>
      <p>O Ritmo auxilia no planejamento e na criação de conteúdo. As sugestões de inteligência artificial podem conter erros e precisam de revisão antes de publicação.</p>
      <h2>2. Conta e uso responsável</h2>
      <p>Você é responsável pela segurança da sua conta, pela legalidade do material enviado e pelos conteúdos que decidir publicar. Não use o serviço para violar direitos de terceiros.</p>
      <h2>3. Sem promessa de resultado</h2>
      <p>O Ritmo não garante alcance, engajamento, vendas ou viralização. Métricas e recomendações são apoios à decisão, não garantias de desempenho.</p>
      <h2>4. Conteúdo e licença técnica</h2>
      <p>Você mantém os direitos sobre seu conteúdo e autoriza apenas o processamento necessário para prestar o serviço.</p>
      <h2>5. Disponibilidade</h2>
      <p>Podemos realizar manutenção e limitar uso abusivo para proteger a segurança e a estabilidade do serviço.</p>
      <h2>6. Encerramento</h2>
      <p>Você pode solicitar exportação e exclusão da conta. Obrigações legais podem exigir retenção limitada de determinados registros.</p>
      <h2>7. Contato</h2>
      <p>O canal oficial de suporte e o responsável legal devem ser configurados antes da abertura pública.</p>
    </article>
  </main>;
}

