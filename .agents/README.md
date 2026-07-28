# Orquestração dos agentes do Ritmo

Esta pasta é o contrato operacional do Go Live. O coordenador executa os gates
em ordem e distribui tarefas somente quando entradas e critérios de aceite estão
claros.

## Fluxo

```text
Coordenador
  ├─ Segurança e Infra ──┐
  ├─ Backend/Domínio ────┼─> QA e Confiabilidade ─> gate da fase
  ├─ Gateway de IA ──────┤
  ├─ Frontend/Produto ───┤
  ├─ Copiloto/Memória ───┤
  ├─ Dados/Métricas ─────┤
  └─ Produto/Nicho ──────┘
             Marketing/Growth opera em paralelo, sem liberar promessas
             ou aquisição antes dos gates de produto.
```

## Protocolo obrigatório de handoff

Cada agente entrega:

1. escopo concluído e arquivos alterados;
2. riscos e decisões tomadas;
3. comandos de teste executados e resultado;
4. evidência para cada critério de aceite;
5. pendências externas, com responsável e prazo;
6. recomendação explícita `APROVAR` ou `BLOQUEAR` o gate.

Nenhum agente pode marcar trabalho como concluído com teste ignorado, dado
fictício apresentado como real ou dependência externa omitida.

## Definições

- [Coordenador](coordinator.md)
- [Segurança e infraestrutura](security-infra.md)
- [Backend e domínio](backend-domain.md)
- [Gateway de IA](ai-gateway.md)
- [Frontend e produto](frontend-product.md)
- [Copiloto e memória](copilot-memory.md)
- [Dados e métricas](data-metrics.md)
- [QA e confiabilidade](qa-reliability.md)
- [Produto e nicho](product-niche.md)
- [Marketing e growth](marketing-growth.md)

