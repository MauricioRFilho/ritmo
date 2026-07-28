# Go Live do Ritmo

Status em 27/07/2026: **aprovado tecnicamente para staging; abertura pública
bloqueada por hospedagem da IA, E2E e decisões externas**.

## Gates

| Gate | Estado | Evidência ou bloqueio |
|---|---|---|
| RLS de tabelas privadas | Validado localmente | migrations do zero e 23 pgTAP, inclusive isolamento entre usuários |
| Auth única | Implementado | Supabase único; SIWC e D1/Drizzle removidos |
| Termos e privacidade | Rascunhos funcionais | páginas e links; faltam contato, responsável e revisão jurídica |
| Ambientes isolados | Staging provisionado | Supabase remoto e VPS de IA ativos; produção separada ainda pendente |
| Onboarding | Implementado | nicho, plataforma, modo de conta e disponibilidade |
| Dashboard real | Implementado | consultas Supabase; agenda fictícia removida |
| Plano semanal | Implementado | geração, revisão, versão confirmada e promoção para conteúdos |
| Conteúdo ponta a ponta | Implementado | ideia, job, polling, revisão, versão e agendamento |
| Chat persistente | Implementado | frontend SSE e mensagens dos dois papéis |
| Memória revisável | Implementado | extração idempotente, promoção segura, origem, aceite/rejeição/arquivo |
| Schemas de IA | Validado | schemas JSON e quatro testes unitários |
| Recuperação de jobs | Implementado | função protegida e chamada periódica |
| Métricas manuais | Implementado | publicação e métricas informadas pelo usuário |
| Exportação de dados | Implementado | JSON autenticado em `/dados` |
| Solicitação de exclusão | Workflow implementado | pedido auditável; executor automático com claim, retry e conclusão pós-exclusão |
| Cotas | Implementado no MVP | contagem horária persistida no Supabase |
| Testes e CI | Implementado local/arquivo | 24 testes de código + 23 pgTAP (47 verificações); workflow criado, execução remota pendente |
| Observabilidade | Parcial | logs correlacionados e rotação Docker na VPS; faltam destino e alertas |
| Três nichos validados | Bloqueado externo | requer criadores piloto |
| Suporte | Bloqueado externo | definir canal, responsáveis e SLA |

## Decisões fechadas

- público inicial: profissional solo;
- onboarding mínimo obrigatório;
- diferencial: Estúdio de conteúdo;
- métricas manuais no MVP;
- Supabase para banco e autenticação;
- CRUD direto sob RLS; gateway dedicado à IA;
- modelo leve para resumo/memória e principal para plano/conteúdo/chat;
- sem D1/Drizzle ou autenticação alternativa;
- nenhum dado fictício em sessão autenticada.

## Evidência mais recente

- `npm run check:release`: passou;
- build: passou;
- código: 24/24 testes (16 Node + 8 Python);
- banco/RLS: 23/23 testes;
- dependências de produção: `npm audit --omit=dev` com 0 vulnerabilidades;
- Docker de produção: configuração validada;
- CI: workflow versionado;
- VPS staging: gateway, workers e Ollama estáveis;
- gateway público HTTPS validado em `https://ritmo-api.gapet.com.br`;
- evidências: `docs/evidencias/2026-07-27-vps-staging.md` e `docs/evidencias/2026-07-28-tls-qa.md`;
- Sites: projeto owner-only ainda precisa receber a URL do gateway e passar pelo E2E.

## Recursos e decisões externos necessários

- publicação e E2E autenticado do frontend de staging;
- projeto Supabase separado de produção;
- domínio;
- responsável legal, contato de privacidade e retenção;
- suporte e SLA;
- capacidade/cota comercial;
- revisão jurídica;
- pilotos de três nichos.

## Regra de promoção

Staging está autorizado quando os recursos forem configurados. Produção somente
após E2E autenticado, restore, alertas, rollback, revisão legal e aprovação do
Coordenador com evidências.

