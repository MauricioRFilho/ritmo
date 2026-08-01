# Go Live do Ritmo

Status em 30/07/2026: **staging técnico operacional; Go Live público bloqueado por gates internos de release e dependências externas**.

## Gates verificados

| Gate | Estado | Evidência ou bloqueio |
|---|---|---|
| API pública de staging | Aprovado | health e docs `200`; CORS aceita a origem atual do Sites |
| RLS e banco local | Aprovado | reset incremental e 33 pgTAP, incluindo aprovação criativa funcional |
| Aprovação de conteúdo | Aprovado localmente | validação server-side, limite de payload, isolamento e idempotência |
| Catálogo criativo | Aprovado localmente | 8 modelos JSON passam no validador; consumo especializado em runtime ainda é evolução futura |
| Build e código | Aprovado localmente | build, 33 Node e 21 Python passam; houve flakiness transitória de arquivos no Vinext/Vite no Windows |
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
- Node: 33/33;
- Python: 21/21;
- banco/RLS: 33/33 pgTAP após reset local;
- biblioteca criativa: 8 modelos válidos;
- API de staging: `/v1/health` e `/docs` responderam `200` em 30/07/2026;
- CORS: preflight autenticado aceitou a origem `ritmo-criador.mauricio-srfh.chatgpt.site`.

Total de verificações automatizadas contabilizadas: **87** (33 Node + 21 Python + 33 pgTAP), além do validador dos 8 modelos.

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
