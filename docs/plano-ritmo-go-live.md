# Ritmo — Plano de Produto até o Go Live

> Baseado no diagnóstico técnico de 27/07/2026 (`docs/PROJETO.md`) e na decisão de ampliar o público-alvo para qualquer criador de conteúdo (amador, profissional, influencer/equipe) e qualquer nicho.

---

## 1. Sumário executivo

O Ritmo está em estágio de MVP técnico: fundação (auth, schema, gateway de IA, fila, worker) pronta, mas o fluxo de ponta a ponta — dashboard real, chat conectado, geração de conteúdo, memória e métricas — ainda não está integrado. Este plano organiza o caminho até o Go Live em 5 fases, com um ajuste transversal: desde a Fase 2, o produto já nasce desenhado para múltiplos perfis de criador e múltiplos nichos, não apenas o público inicial (criador BR solo, TikTok/Instagram).

Go Live = produto publicamente acessível, com autenticação real, jornada principal completa (onboarding → planejamento → geração → publicação → aprendizado), segurança validada e capacidade de suportar os três perfis de público (hobby, profissional, equipe) em pelo menos um nicho de conteúdo cada.

---

## 2. Visão de produto ampliada

### Público

| Perfil | Necessidade central | Prioridade de features |
|---|---|---|
| Amador/hobbista | Consistência sem pressão, baixo atrito | Onboarding rápido, cadência leve, sem métricas de receita |
| Profissional solo | Crescimento e conversão | Calendário editorial, metas, aprendizado por métrica |
| Influencer/equipe/agência | Produção em escala | Papéis, aprovação, múltiplas marcas, comparação de contas |

### Nicho de conteúdo

O produto não deve ser hardcoded para um formato. `creator_preferences` ganha um campo de **taxonomia de nicho** (educativo, comédia, lifestyle, negócios, gaming, culinária, etc.), que alimenta templates de roteiro, vocabulário do copiloto e benchmarks de métricas.

### Plataformas

TikTok e Instagram seguem como prioridade de lançamento. `platform_profiles` deve ser desenhado como adaptador plugável, preparando espaço para YouTube Shorts, LinkedIn, Pinterest e X sem redesenho de schema.

### Princípios (mantidos do documento original)

- rotina sustentável;
- contexto antes da geração;
- usuário confirma mudanças;
- memória revisável e rastreável;
- honestidade sobre alcance;
- privacidade por usuário e possibilidade de IA local.

---

## 3. Fases do roadmap

### Fase 1 — Fundação segura (pré-requisito de tudo)

**Objetivo:** eliminar riscos críticos e ambiguidades antes de construir por cima.

Entregas:
- corrigir RLS de `audit_events` (crítico — hoje fora do bloco de RLS);
- decidir e unificar a estratégia de autenticação (remover `chatgpt-auth.ts` ou README desatualizado sobre Google OAuth);
- publicar Termos de Uso e Política de Privacidade (com página real, não só metadado);
- proteger rotas privadas no servidor/middleware, não só no cliente;
- separar ambientes (dev/staging/produção) e segredos;
- decidir sobre D1/Drizzle residual (remover se não houver uso concreto) e `examples/d1/`;
- definir hospedagem definitiva de gateway, worker e Ollama.

**Critério de saída:** nenhuma pendência de segurança crítica; ambiente de produção definido; repositório sem ambiguidade arquitetural.

---

### Fase 2 — Vertical slice completo

**Objetivo:** um usuário consegue entrar, planejar, gerar e confirmar um conteúdo real, de ponta a ponta — antes de expandir telas isoladas.

Entregas de produto:
- onboarding mínimo: nicho, plataforma(s), modo de conta (hobby/profissional/equipe), disponibilidade básica;
- dashboard "Hoje" e calendário consumindo dados reais de `content_plans` (fim dos dados fictícios);
- criação manual de uma ideia de conteúdo;
- geração assíncrona via gateway (`/v1/content/generate`), com acompanhamento de status do job;
- revisão e confirmação humana do resultado (nunca aplicar sem confirmação);
- persistência em `content_versions`;
- agendamento e exibição no calendário.

Entregas técnicas de suporte:
- schemas Pydantic/TypeScript por operação de IA (elimina saídas sem formato);
- estados reais de carregamento, erro e vazio no frontend;
- logout visível e carregamento de perfil real.

**Critério de saída:** um usuário real consegue concluir o ciclo completo "ideia → conteúdo gerado → revisado → agendado" sem dados fictícios.

---

### Fase 3 — Copiloto com memória

**Objetivo:** o chat deixa de ser simulado e passa a ser o diferencial real do produto.

Entregas:
- conectar `/v1/chat/stream` ao frontend (fim da resposta fixa);
- persistir histórico de conversa (mensagens do usuário e do assistente);
- resumos de conversa (`conversation_summaries`) para contexto de longo prazo;
- extração de memórias sugeridas, com caixa de entrada de revisão (aceitar/rejeitar/expirar);
- rastreabilidade: toda recomendação que usa uma memória avisa a origem;
- exportação e exclusão de memórias e conversas (requisito de privacidade).

**Critério de saída:** o copiloto conversa com contexto real, sugere memórias e o usuário tem controle total sobre o que é lembrado.

---

### Fase 4 — Ciclo de aprendizado

**Objetivo:** o produto aprende com o resultado publicado, fechando o loop que diferencia o Ritmo de um gerador genérico de conteúdo.

Entregas:
- registro de publicação e métricas (`publication_results`, `metric_snapshots`) — manual/CSV no MVP, integrações oficiais quando viáveis;
- metas por perfil de público (alcance para uns, conversão/vendas para outros, consistência para o hobbista);
- comparação por formato/tema/gancho/horário, com confiança estatística mínima antes de recomendar;
- retrospectiva semanal;
- uso do histórico pessoal para ajustar sugestões do plano seguinte.

**Critério de saída:** recomendações passam a se basear em dados reais do próprio criador, não apenas em heurísticas genéricas.

---

### Fase 5 — Escala, públicos e monetização

**Objetivo:** suportar os três perfis de público de forma robusta e sustentar operação em produção.

Entregas de produto:
- modo de conta "equipe/agência": papéis, comentários, aprovação, múltiplas marcas;
- templates de nicho adicionais além do conjunto inicial;
- adaptadores de plataforma adicionais (YouTube Shorts como primeiro candidato);
- painel administrativo básico;
- modelo de assinatura/cobrança por modo de conta.

Entregas de confiabilidade:
- rate limiting e cotas por usuário;
- logs estruturados, métricas e correlação por job;
- recuperação automática de jobs presos em `running`;
- cache seguro e fallback entre modelo leve/principal;
- testes: unitários, integração, RLS, E2E na jornada principal;
- CI com lint, build e testes;
- backup, retenção definida e exclusão de conta sob demanda.

**Critério de saída:** produto suporta os três perfis de público em produção, com observabilidade e recuperação de falhas.

---

## 4. Decisões que precisam ser fechadas antes de avançar

### Produto
- Primeiro público de lançamento entre os três (hobby, profissional, equipe) — recomendação: profissional solo, por ser o público já documentado e o que mais valida o loop de aprendizado.
- Onboarding obrigatório vs. progressivo — recomendação: mínimo obrigatório + aprofundamento progressivo guiado pelo copiloto.
- Diferencial de lançamento: planejamento, roteiro ou memória — recomendação: geração de roteiro (Estúdio de conteúdo), por ser o valor mais tangível e demonstrável.
- Métricas manuais no MVP — recomendação: sim, integrações oficiais ficam para a Fase 5.

### Tecnologia
- Onde o Ollama roda em produção (servidor próprio vs. máquina do cliente) — impacta custo e privacidade, precisa decisão antes da Fase 1 fechar hospedagem.
- Frontend faz CRUD direto no Supabase ou existe backend de domínio? Definir antes da Fase 2 para evitar retrabalho.
- Cloudflare/Vinext permanece definitivo como stack de hospedagem?
- Remoção definitiva de D1/Drizzle e da estratégia alternativa de auth.

### Privacidade
- Prazo de retenção de conversas e logs.
- Tipos de memória proibidos (ex.: dados sensíveis de terceiros).
- Processo formal de exportação/exclusão de dados.
- Fontes permitidas para tendências (`trend_evidence`).
- Quais dados podem ir a modelos remotos vs. apenas ao Ollama local.

---

## 5. Riscos priorizados

| Item | Impacto | Prioridade |
|---|---|---:|
| `audit_events` sem RLS | Exposição/alteração indevida | Crítica |
| Dashboard sem dados reais | Fluxo central indisponível | Alta |
| Chat visual simulado | Proposta principal incompleta | Alta |
| Resposta do assistente não persistida | Histórico incompleto | Alta |
| Saídas de IA sem schema | Resultados frágeis | Alta |
| Jobs presos sem recuperação | Fila perde capacidade | Alta |
| Falhas sem telemetria | Diagnóstico incompleto | Alta |
| Proteção de rota apenas no cliente | Segurança insuficiente | Alta |
| Cobertura de testes mínima | Regressões não detectadas | Alta |
| D1/Drizzle residual | Ambiguidade arquitetural | Média |
| Taxonomia de nicho ausente | Limita expansão de público | Média |
| Adaptador de plataforma único (TikTok/Instagram) | Limita expansão de público | Média |
| Modelo leve sem uso | Complexidade ociosa | Baixa |

---

## 6. Critérios de pronto para o Go Live

- conta e sessão funcionam em produção, com termos e política publicados;
- RLS de todas as tabelas privadas testada, incluindo `audit_events`;
- onboarding mínimo concluído para os três modos de conta;
- dashboard mostra apenas dados reais do próprio usuário;
- contexto, disponibilidade, metas e nicho são editáveis;
- plano semanal pode ser gerado, revisado e confirmado;
- roteiro pode ser gerado, editado, versionado e agendado;
- chat possui histórico persistido e memória revisável pelo usuário;
- resultado de publicação pode ser registrado e usado no ciclo de aprendizado;
- falhas de IA são recuperáveis e comunicadas de forma compreensível;
- rate limiting e cotas ativos;
- jornada principal (onboarding → geração → publicação) possui teste E2E;
- observabilidade mínima (logs, métricas, correlação por job) em produção;
- processo de exportação e exclusão de dados disponível ao usuário.

---

## 7. Checklist de lançamento

- [ ] Ambientes de produção e staging separados, com segredos isolados
- [x] RLS auditada em todas as tabelas privadas
- [x] Termos de Uso e Política de Privacidade publicados e linkados (rascunhos; revisão jurídica pendente)
- [x] Autenticação única e consistente (sem estratégia residual)
- [x] Onboarding coberto por contratos para os três modos de conta (E2E real pendente)
- [ ] Fluxo vertical completo (ideia → geração → revisão → agendamento) validado por usuários reais
- [x] Chat conectado, com histórico e memória funcionando
- [x] Registro de publicação e métricas operacional (manual)
- [x] Rate limiting e cotas persistentes configurados no MVP
- [ ] Monitoramento e alertas de falha de job ativos
- [ ] Testes E2E da jornada principal passando em CI
- [x] Processo de exportação/exclusão de dados documentado e funcional
- [ ] Plano de suporte ao usuário definido (canal, SLA mínimo)

---

## 8. Observação sobre escopo

Este plano assume que a expansão de público (hobby/profissional/equipe) e de nicho é feita por **generalização do modelo de dados já existente** (`creator_preferences`, `platform_profiles`, `creator_goals`), evitando novas tabelas ou módulos paralelos. O risco a evitar é tentar suportar "qualquer público, qualquer conteúdo" antes de validar o loop completo com um único público — por isso a Fase 2 mantém escopo restrito, e a generalização de públicos/nichos entra formalmente na Fase 5.
