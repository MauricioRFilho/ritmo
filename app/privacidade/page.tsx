import Link from "next/link";

export const metadata = { title: "Política de Privacidade — Ritmo" };

export default function PrivacyPage() {
  return <main className="legal-page">
    <article>
      <Link href="/">← Voltar ao Ritmo</Link>
      <h1>Política de Privacidade</h1>
      <p>Última atualização: 27 de julho de 2026.</p>
      <h2>Dados tratados</h2>
      <p>Tratamos dados de conta, preferências, agenda, conteúdo, conversas, memórias confirmadas, publicações, métricas e registros técnicos necessários à segurança.</p>
      <h2>Finalidades</h2>
      <p>Usamos os dados para autenticar, planejar conteúdo, gerar sugestões, preservar contexto autorizado, medir desempenho e proteger o serviço.</p>
      <h2>Inteligência artificial</h2>
      <p>O gateway processa somente o contexto necessário. Memórias sugeridas dependem de confirmação e podem ser rejeitadas, arquivadas ou excluídas.</p>
      <h2>Compartilhamento</h2>
      <p>Dados são compartilhados apenas com operadores necessários à hospedagem, autenticação e processamento, conforme a configuração do ambiente.</p>
      <h2>Retenção e segurança</h2>
      <p>Conversas e conteúdo permanecem até exclusão pelo usuário ou encerramento da conta. Logs operacionais devem seguir a política de retenção definida para produção.</p>
      <h2>Seus direitos</h2>
      <p>Você pode corrigir, exportar e excluir seus dados, além de revogar memórias autorizadas. O fluxo operacional está descrito na documentação de privacidade do projeto.</p>
      <h2>Contato</h2>
      <p>O encarregado e o canal de privacidade devem ser preenchidos antes da abertura pública.</p>
    </article>
  </main>;
}

