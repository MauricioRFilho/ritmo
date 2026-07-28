# Ritmo

Copiloto de conteúdo para criadores de TikTok e Instagram. O produto combina
calendário, contexto pessoal, memória revisável, métricas e geração local de IA
com Ollama.

## Estado de lançamento

O vertical slice está implementado e validado localmente. O projeto está
**aprovado para staging**, mas a abertura pública permanece bloqueada até E2E,
infraestrutura, observabilidade e aprovações externas. Consulte
[`docs/GO-LIVE.md`](docs/GO-LIVE.md).

## Documentação

- [`docs/PROJETO.md`](docs/PROJETO.md): produto e arquitetura;
- [`docs/plano-ritmo-go-live.md`](docs/plano-ritmo-go-live.md): roadmap e critérios;
- [`docs/ritmo-agentes-marketing-nichos.md`](docs/ritmo-agentes-marketing-nichos.md): agentes, marketing e nichos;
- [`docs/GO-LIVE.md`](docs/GO-LIVE.md): gates, decisões e bloqueios;
- [`docs/TESTES.md`](docs/TESTES.md): estratégia e evidências;
- [`docs/CI.md`](docs/CI.md): integração contínua e proteção de branch;
- [`docs/OPERACAO.md`](docs/OPERACAO.md): release, rollback e incidentes;
- [`.agents/README.md`](.agents/README.md): contratos de orquestração.

## Componentes

- `app/`: jornada real, dashboard, autenticação e privacidade;
- `supabase/migrations/`: domínio, índices, RLS, fila e workflows;
- `services/ai-gateway/`: gateway FastAPI, schemas e worker;
- `docker-compose.yml`: gateway, worker e Ollama em rede privada.

Supabase é o único banco e provedor de autenticação. D1/Drizzle e a estratégia
alternativa de autenticação foram removidos.

## Configuração local

1. Inicie o Supabase com `supabase start`.
2. Aplique as migrations com `supabase db reset`.
3. Copie `.env.example` para `.env`/`.env.local` e preencha as chaves.
4. Configure as URLs de autenticação por e-mail.
5. Execute `npm run dev`.
6. Execute `docker compose up --build` para a IA.
7. Baixe `qwen3:8b` e `qwen3:4b` no Ollama.

Sem Supabase, o frontend mostra somente a tela explícita de configuração; nunca
apresenta agenda ou métricas fictícias como dados reais.

## Segurança

A chave publishable pode ser usada no navegador. A `service_role` pertence
somente ao gateway/worker. O Ollama fica em rede interna e as tabelas privadas
possuem RLS validada por testes com dois usuários.

## Validação

```bash
npm run check:release
npm audit --omit=dev --audit-level=low
```

Último gate local: **47/47 verificações verdes** e **0 vulnerabilidades** na
árvore de produção. Isso autoriza staging; não substitui o E2E autenticado nem
os gates externos de produção.
