# Evidência — revisão mobile-first e legibilidade

Data: 2026-07-29

## Escopo

- Escala tipográfica elevada em dashboard, autenticação, onboarding, copiloto, semana e dados.
- Texto funcional com piso de 12 px; texto auxiliar e labels priorizados em 14 px; campos em 16 px.
- Controles globais com alvo mínimo de 44 px e campos críticos com 48–52 px.
- Onboarding e copiloto passam a ocupar a viewport móvel com `100dvh` e safe areas.
- Grids críticos passam para uma coluna em celulares.
- Foco visível reforçado para navegação por teclado.

## Validação

- `npm run check`: APROVADO.
- Python: 9 testes aprovados.
- Node: 19 testes aprovados, incluindo 2 guardrails mobile-first.
- Build de produção: APROVADO.
- Viewports definidos para inspeção: 320, 360, 390, 412, 768, 1024 e 1440 px.

## Limitação registrada

O ambiente desta execução não disponibilizou navegador conectado. Portanto, não houve captura visual automatizada nem validação por screenshot. Essa limitação não foi convertida em evidência fictícia; a revisão visual manual permanece recomendada após a publicação.

## Handoff

Frontend/Produto: implementação concluída nos estilos globais e de domínio.

QA/Confiabilidade: suíte automatizada verde; guardrails de legibilidade adicionados. A inspeção visual manual em dispositivo real permanece como acompanhamento recomendado.

Recomendação do coordenador: APROVAR a publicação com monitoramento visual pós-deploy e correção imediata caso seja identificado truncamento específico de dispositivo.
