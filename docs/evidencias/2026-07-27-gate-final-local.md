# Gate final local — 27/07/2026

## Resultado

`npm run check:release`: **passou**.

- lint e build;
- compilação Python;
- 8 testes Python de gateway, schemas, worker e privacidade;
- 16 testes Node de rotas e contratos;
- 23 testes pgTAP de RLS, isolamento e privacidade;
- total: **47 verificações automatizadas verdes**.

`npm audit --omit=dev --audit-level=low`: **0 vulnerabilidades** na árvore de produção.

A árvore de desenvolvimento mantém alertas transitivos em `minimatch`/
`brace-expansion` usados pelos plugins de lint do Next. O override para a versão
corrigida é incompatível com a API antiga e ESLint 10 ainda não é aceito pelos
peers desses plugins; risco aceito somente no ambiente de CI, sem dependência no
bundle de produção.

`docker compose -f docker-compose.yml -f docker-compose.production.yml config
--quiet`: **passou**.

## Funcionalidades provadas por contrato

- onboarding;
- plano semanal revisável;
- ideia → roteiro → versão → agenda;
- chat SSE persistente;
- extração e revisão de memória;
- publicação e métricas;
- exportação e solicitação de exclusão;
- isolamento RLS.

## Infraestrutura

O Sites existente é owner-only, mas não possui variáveis de produção. A
configuração local aponta o gateway para `localhost`. Não existe URL hospedada
para gateway/worker/Ollama, então nenhuma versão nova foi promovida.

## Decisão do Coordenador

`APROVAR STAGING` após provisionamento. `BLOQUEAR PRODUÇÃO` até E2E real e
dependências externas listadas em `docs/GO-LIVE.md`.
