# Evidência — Biblioteca pública e comunidade — 30/07/2026

## Escopo validado

- catálogo unificado com 24 templates oficiais versionados;
- blog público, detalhe, filtros, busca, SEO, sitemap e JSON-LD;
- publicação autenticada com snapshot server-side e moderação humana;
- curtidas, salvamentos, denúncias e adaptação com RLS e idempotência;
- adaptação pelo gateway usando template aprovado por ID e versão;
- proveniência privada preservada;
- flags read, submissions, interactions e adaptation desligadas por padrão no frontend e no banco.

## Gates executados

- lint: PASS;
- build de produção com gateway público: PASS;
- Node: 42/42 PASS;
- Python: 37/37 PASS;
- pgTAP/RLS: 81/81 PASS;
- modelos: 24/24 válidos;
- npm audit --omit=dev: 0 vulnerabilidades;
- git diff --check: PASS.

Total automatizado: 160 testes, além dos 24 modelos validados.

## Handoffs

- Backend/Segurança: APROVAR staging; flags server-side e retries seguros.
- Gateway de IA: APROVAR; referência exata ID+versão e chave idempotente.
- Frontend/Produto: APROVAR; mobile-first, SEO e rollout fail-closed.
- Coordenador: produção pública BLOQUEADA até restore, rollback, alertas, infraestrutura isolada, capacidade, revisão jurídica, suporte/SLA e piloto moderado.

## Operação de flags

As flags começam desligadas em cada ambiente. A ativação é explícita por service role/postgres, em ordem: read, submissions para piloto, interactions e adaptation. Nunca habilitar todas antes dos testes autenticados de staging.

## Limitações restantes

- E2E visual autenticado em staging ainda obrigatório;
- ensaio de restore/rollback e carga ainda sem evidência;
- canal de suporte, responsável legal e política operacional precisam de aprovação externa;
- não houve publicação ou deploy nesta entrega.

## Promoção a candidato oficial

O comando `npm run promote:community -- <community_post_uuid>` exige worktree limpo e service role apenas no terminal do moderador. Ele consulta somente template comunitário aprovado/ativo, cria branch `candidate/*`, valida o catálogo, faz push da branch e abre PR draft para `main`. Não escreve diretamente na principal.
