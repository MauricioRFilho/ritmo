# Retomada do gate de Go Live — 30/07/2026

## Escopo

Auditoria coordenada de produto/gateway, segurança/infra e QA sobre a branch `agent/creative-model-human-review`.

## Correções locais

- aprovação de conteúdo validada no PostgreSQL, com payload máximo de 64 KiB e campos estruturais limitados;
- chave idempotente estável no frontend e RPC; retry não duplica versão, agenda ou job de memória;
- botão de confirmação bloqueado durante envio;
- `/docs`, `/redoc` e `/openapi.json` fechados quando `ENVIRONMENT=production`;
- headers defensivos no gateway e rate limit versionado no Nginx;
- testes funcionais de aprovação, isolamento, atomicidade e retry.

## Evidências executadas

- API remota staging: health `200`, docs `200`, rota protegida sem bearer `401` (handoff Infra);
- CORS remoto: preflight `200`, origem exata e `idempotency-key` permitidos;
- `supabase db reset --local --no-seed`: migrations aplicadas até `202607300001`;
- `npm run test:db`: 33/33 pgTAP;
- `npm run build`: PASS;
- Node: 33/33 PASS (31 suíte completa + 2 contratos novos de hardening);
- Python: 21/21 PASS;
- `npm run lint`: PASS;
- `npm run validate:creative-models`: 8 modelos válidos.

## Flakiness observada

Duas execuções concorrentes/anteriores falharam no Windows por `EPERM`/`EBUSY` durante limpeza ou cópia de `dist`. Com processos órfãos encerrados, o build isolado passou. O QA também observou uma falha transitória de arquivo no Vinext. A causa parece uma corrida de I/O do toolchain, mas não está encerrada; CI Linux e repetição limpa são obrigatórios antes da promoção.

## Bloqueios restantes

- PR/CI remoto e branch protection;
- E2E visual autenticado no artefato atual;
- aplicação e smoke do hardening na VPS;
- restore, rollback e alertas reais;
- produção isolada e sizing/capacidade;
- jurídico, suporte/SLA e pilotos de nicho;
- consumo especializado dos modelos JSON pelo runtime permanece fora desta promoção até possuir schema/UI/E2E próprios.

## Handoffs

- Produto/Gateway: aprovação crítica corrigida e aprovada após pgTAP/build pelo coordenador.
- Segurança/Infra: staging saudável; produção bloqueada até hardening remoto, restore, alertas, isolamento e capacidade.
- QA: staging aprovado para continuidade; produção bloqueada até evidências finais.
