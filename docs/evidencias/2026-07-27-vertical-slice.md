# Evidência de gate — vertical slice

Data: 27/07/2026.

## Código

`npm run check`: **passou**.

- 4 testes Python de schemas;
- 9 testes Node de rotas e contratos;
- lint;
- compilação Python;
- build Vinext.

## Banco

`supabase db reset`: **passou**. Todas as quatro migrations foram aplicadas do
zero, incluindo fundação de Go Live e solicitações de privacidade.

`supabase test db`: **15/15 passaram**.

- RLS de `audit_events`;
- políticas append-only;
- campos de modo de conta e nicho;
- índices e privilégios da recuperação de jobs;
- usuário A lê seus próprios dados;
- usuário B não lê auditoria ou conteúdo de A;
- usuário B não altera conteúdo de A;
- usuário B não forja evento de auditoria para A.

## Vertical slice coberto

- onboarding persistente;
- ideia persistente;
- job assíncrono e polling;
- revisão humana;
- `content_versions`;
- agendamento;
- dashboard sem agenda fictícia;
- chat SSE e histórico;
- revisão de memórias;
- publicação/métricas manuais;
- exportação e solicitação de exclusão.

## Limite da evidência

Os contratos e o banco estão validados localmente. A jornada completa ainda
precisa de E2E em staging com gateway, worker e Ollama reais.

## Veredito

`APROVAR` promoção para staging quando o ambiente existir. `BLOQUEAR` produção
até E2E, observabilidade, rollback, revisão legal e responsáveis externos.

