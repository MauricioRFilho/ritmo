# Go Live do Ritmo

Status em 30/07/2026: **staging técnico operacional; Go Live público bloqueado por gates internos de release e dependências externas**.

## Gates verificados

| Gate | Estado | Evidência ou bloqueio |
|---|---|---|
| API pública de staging | Aprovado | health e docs `200`; CORS aceita a origem atual do Sites |
| RLS e banco local | Aprovado | migrations incrementais e 81 pgTAP, incluindo Biblioteca, idempotência e flags server-side |
| Aprovação de conteúdo | Aprovado localmente | validação server-side, limite de payload, isolamento e idempotência |
| Biblioteca pública | Aprovado localmente, flags desligadas | 24 templates; blog/SEO, moderação, RLS, idempotência e adaptação validados; E2E de staging pendente |
| Build e código | Aprovado localmente | build de produção, 42 Node e 37 Python passam; artefato validado sem recursos locais |
| Hardening da API | Aprovado localmente | docs fechadas em produção, headers defensivos e rate limit Nginx versionados; aplicação remota pendente |
| Jornada autenticada atual | Bloqueado | falta E2E visual completo após as mudanças de 29–30/07 |
| CI remoto | Bloqueado | branch atual ainda não integrada à `main`; check remoto e branch protection sem evidência |
| Restore e rollback | Bloqueado | falta restauração real em staging descartável e ensaio desta release |
| Alertas | Bloqueado | logs existem, mas destino e alertas mínimos ainda não estão ativos/testados |
| Produção isolada | Bloqueado | falta Supabase e infraestrutura separados do staging |
| Capacidade de IA | Bloqueado | VPS atual sem GPU/3,8 GiB usa modelo reduzido; falta sizing e teste de carga |
| Jurídico | Bloqueado externo | responsável, contato, retenção e revisão jurídica |
| Suporte | Bloqueado externo | canal, responsável e SLA |
| Pilotos | Bloqueado externo | validação com criadores de pelo menos três nichos |

## Evidência local atual

- `npm run lint`: passou;
- `npm run build`: passou;
- Node: 42/42;
- Python: 37/37;
- banco/RLS: 81/81 pgTAP após migrations locais;
- biblioteca criativa: 24 modelos válidos;
- biblioteca pública: 42 Node, 37 Python e 81 pgTAP aprovados; npm audit sem vulnerabilidades;
- API de staging: `/v1/health` e `/docs` responderam `200` em 30/07/2026;
- CORS: preflight autenticado aceitou a origem `ritmo-criador.mauricio-srfh.chatgpt.site`.

Gate atual da Biblioteca: **160 testes** (42 Node + 37 Python + 81 pgTAP), além do validador dos 24 modelos.

## Decisões vigentes

- staging permanece disponível para correções e aceite;
- produção não reutilizará banco, segredos ou capacidade do staging;
- nenhum modelo criativo entra no catálogo oficial sem revisão humana;
- aprovação editorial não significa performance validada;
- migrations permanecem incrementais e promoção exige backup e rollback verificáveis.

## Próxima sequência de promoção

1. integrar a branch por PR revisada e obter CI verde;
2. aplicar migrations em staging e recriar gateway/worker com o mesmo artefato;
3. validar `nginx -t`, headers, rate limit, health e CORS;
4. executar E2E autenticado visual: login, onboarding/contexto, geração curta, revisão, retry de confirmação, agenda e memória;
5. executar backup, restore em ambiente descartável e ensaio de rollback;
6. ativar e disparar alertas mínimos;
7. provisionar produção isolada e validar capacidade;
8. fechar jurídico, suporte/SLA e pilotos;
9. promover somente após handoff final de QA e aprovação do coordenador.

## Regra de promoção

Staging pode receber as correções após PR e QA. Produção pública permanece bloqueada até E2E autenticado, restore, alertas, rollback, isolamento de produção, capacidade, revisão legal e aprovação do coordenador possuírem evidências verificáveis.
