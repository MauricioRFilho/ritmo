# Qualidade de roteiros curtos — 29/07/2026

## Incidente

Uma geração de vídeo curto foi apresentada como pronta apesar de conter apenas
placeholders (`ganchos`, `cenas`, `falas`, `captação`, `edição`, `exercícios`)
e cinco cenas de 30 segundos, totalizando 150 segundos.

## Causa

- prompt de geração excessivamente genérico;
- schema permitia até 30 cenas de até 300 segundos cada;
- ausência de limite para a soma do roteiro;
- ausência de validação semântica de placeholders e duplicidade;
- frontend tratava `job.result` como válido por cast e promovia imediatamente o
  conteúdo para revisão.

## Correção

### Gateway e worker

- exatamente três opções de gancho específicas;
- duas a oito cenas, sequenciais e não duplicadas;
- cenas de dois a vinte segundos;
- Reel e vídeo curto limitados a 60 segundos, com alvo de 20–45 segundos;
- Story limitado a 45 segundos;
- carrossel não recebe indevidamente o limite temporal de vídeo;
- placeholders, inclusive variantes acentuadas, rejeitados;
- prompt especializado por formato;
- payload do formato encaminhado ao validador.

### Frontend

- validação em runtime antes de exibir “roteiro pronto”;
- resultado inválido não muda o plano para revisão;
- nova validação após edição de legenda/CTA e antes da versão imutável;
- duração total e limite exibidos no Estúdio;
- orientações de captação e edição exibidas;
- arrays obrigatórios validados antes da renderização.

## Testes e QA

- lint: aprovado;
- build Vinext: aprovado;
- Node: 29/29;
- Python: 17/17;
- casos adversariais: 150 segundos, placeholders isolados e acentuados,
  duplicidade e limites por formato;
- QA Gateway: **APROVAR**;
- QA Frontend: **APROVAR**.

## Publicação

- worker reconstruído isoladamente na VPS, ativo e consumindo a fila;
- gateway direto e público saudável (`200`);
- frontend Sites versão 9 publicada com sucesso;
- URL: `https://ritmo-criador.mauricio-srfh.chatgpt.site`.

## Pendente externo

Repetir uma geração autenticada na sessão do usuário. Esse smoke precisa
confirmar conteúdo útil e duração no produto real; não há credencial de sessão
do usuário disponível para automação fora do navegador.
