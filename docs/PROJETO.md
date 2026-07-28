# Ritmo — documentação do projeto

> Diagnóstico de base realizado em 27/07/2026. Preserve este documento como fotografia do estado inicial; para o estado executado e os bloqueios atuais, consulte `GO-LIVE.md` e `evidencias/2026-07-27-gate-final-local.md`.

## 1. Resumo executivo

O **Ritmo** é um copiloto de conteúdo para criadores de TikTok e Instagram. A proposta é combinar rotina, contexto, recursos, metas, memória e resultados para produzir um planejamento sustentável e roteiros executáveis, com IA local e controle humano.

O projeto está em estágio de **MVP técnico/protótipo funcional**. Já existem uma interface responsiva, autenticação por e-mail, um modelo de dados amplo no Supabase, um gateway FastAPI, uma fila persistente e um worker integrado ao Ollama. Porém, o dashboard ainda usa dados estáticos e o chat visual não chama o backend. A fundação é boa; falta conectar as peças em um fluxo real de ponta a ponta.

## 2. Visão do produto

### Problema

Criadores frequentemente não conseguem manter consistência sem sobrecarga, recebem sugestões genéricas, perdem aprendizados entre publicações e não convertem métricas em decisões. Também precisam alternar entre agenda, notas, roteiros e ferramentas de IA.

### Proposta de valor

O Ritmo deve conhecer a disponibilidade, metas, plataformas, equipamentos, locais, estilo, restrições, histórico e memórias autorizadas do criador. Com isso, sugere **o que criar, quando criar e como executar**, sem prometer viralização e sem aplicar mudanças importantes sem confirmação.

### Público inicial

- criadores individuais brasileiros;
- autônomos e pequenos negócios que atraem clientes por conteúdo;
- produção prioritária para Instagram e TikTok;
- idioma `pt-BR` e fuso padrão `America/Sao_Paulo`.

### Princípios

- rotina sustentável;
- contexto antes da geração;
- usuário confirma mudanças;
- memória revisável e rastreável;
- honestidade sobre alcance;
- privacidade por usuário e possibilidade de IA local.

## 3. Mapa funcional e estado atual

| Módulo | Objetivo | Estado |
|---|---|---|
| Hoje | Resumo do ritmo e próxima ação | Interface demonstrativa |
| Calendário | Organizar conteúdos e tarefas | Interface estática |
| Minha semana | Planejar capacidade semanal | Banco e API, sem tela real |
| Conteúdos | Criar, revisar e versionar peças | Banco e API, sem tela real |
| Desempenho | Metas, métricas e aprendizados | Banco, sem tela real |
| Memórias | Revisar o que a IA pode lembrar | Banco e API, sem tela real |
| Meu contexto | Rotina, recursos, perfil e restrições | Banco, sem tela real |
| Copiloto | Conversar usando contexto autorizado | Backend pronto; frontend simulado |
| Tendências | Interpretar evidências rastreáveis | Fila e tabela; coleta ausente |
| Autenticação | Cadastro, login e recuperação | Implementada |
| Configurações | Conta, privacidade e modelos | Apenas navegação visual |

## 4. O que temos

### Frontend

Stack: React 19, Next.js 16, Vinext/Vite, TypeScript estrito, CSS próprio, Lucide e Supabase JS.

Implementado:

- dashboard com sidebar, indicadores, calendário, painel do dia e copiloto;
- layouts desktop e mobile;
- menu móvel e barra inferior;
- metadados SEO/Open Graph, favicon e imagem social;
- respeito a `prefers-reduced-motion`;
- redirecionamento ao login quando Supabase está configurado e não há sessão.

Limites:

- calendário, métricas, perfil, tarefas e conversa vêm de constantes/estado local;
- navegação e botões principais não executam operações reais;
- chat retorna uma resposta fixa;
- dados não sobrevivem ao reload;
- faltam onboarding e estados reais de carregamento, erro e vazio.

### Autenticação

Implementada com Supabase Auth:

- cadastro e login por e-mail/senha;
- recuperação e atualização de senha;
- sessão persistente e renovação automática;
- aceite dos termos nos metadados;
- trigger para criar `profiles` após o cadastro.

Pendências:

- README mencionava Google OAuth, mas a UI atual não oferece esse método;
- Termos e Política de Privacidade não possuem páginas/links;
- não há logout visível;
- proteção de rota é apenas no cliente;
- `app/chatgpt-auth.ts` contém uma estratégia alternativa não usada.

### Banco Supabase/PostgreSQL

O domínio possui 23 tabelas:

- **Perfil/contexto:** `profiles`, `creator_preferences`, `equipment_items`, `available_locations`, `platform_profiles`;
- **Metas/agenda:** `creator_goals`, `recurring_availability`, `schedule_exceptions`;
- **Planejamento/conteúdo:** `weekly_plans`, `content_plans`, `content_tasks`, `content_versions`;
- **Resultados:** `metric_snapshots`, `publication_results`;
- **Conversa/memória:** `conversations`, `messages`, `conversation_summaries`, `creator_memories`, `memory_sources`;
- **IA/operação:** `trend_evidence`, `ai_jobs`, `ai_usage_events`, `audit_events`.

Também existem enums de memória e jobs, índices de busca, RLS por proprietário, função de claim concorrente com `SKIP LOCKED` e trigger de perfil.

### Gateway de IA

O FastAPI expõe:

| Método | Endpoint | Função |
|---|---|---|
| GET | `/v1/health` | Saúde básica |
| GET | `/v1/models/status` | Estado do Ollama |
| POST | `/v1/chat/stream` | Chat SSE |
| POST | `/v1/plans/generate` | Gerar plano |
| POST | `/v1/plans/revise` | Revisar plano |
| POST | `/v1/content/generate` | Gerar conteúdo |
| POST | `/v1/content/revise` | Revisar conteúdo |
| POST | `/v1/trends/research` | Interpretar tendências |
| POST | `/v1/memories/extract` | Extrair memórias |
| POST | `/v1/conversations/summarize` | Resumir conversa |
| GET | `/v1/jobs/{job_id}` | Consultar job |
| POST | `/v1/jobs/{job_id}/cancel` | Cancelar job na fila |

Já há autenticação Bearer validada no Supabase, contexto compacto de perfil/memórias, streaming, CORS, idempotência opcional e isolamento dos jobs por usuário.

Limites: o histórico não entra no prompt, a resposta do assistente não é persistida, `context_scope` não é usado, saídas não têm schema por operação, não há rate limit/cotas e o frontend não usa nenhum endpoint.

### Worker e Ollama

O worker reivindica jobs concorrentemente, usa `qwen3:8b`, pede JSON, grava resultado e uso, e aplica retry exponencial. O Docker Compose mantém o Ollama em rede interna e persiste modelos em volume.

Faltam logs estruturados, evento de uso em falhas, progresso incremental, recuperação de jobs presos em `running`, cancelamento em execução, validação por schema, uso do modelo leve e promoção segura do resultado para entidades do domínio.

### Infraestrutura

- frontend Vinext/Cloudflare;
- gateway e worker em Python 3.12;
- Supabase para Auth/PostgreSQL;
- Ollama local em Docker;
- configuração de hospedagem Sites existente.

Há uma sobreposição arquitetural: Supabase é o banco real, enquanto D1/Drizzle está vazio e parece residual do template. Recomenda-se remover D1, `db/` e `examples/d1/` se não houver caso de uso concreto.

### Testes

Existem apenas smoke tests do HTML do dashboard e login. Faltam testes de componentes, autenticação, RLS, gateway, SSE, fila, retry, acessibilidade e fluxo E2E.

## 5. Arquitetura

```text
Navegador (React/Next/Vinext)
  ├── Auth e CRUD ─────────────► Supabase (Auth + PostgreSQL + RLS)
  └── IA, Bearer token ────────► FastAPI Gateway
                                     ├── chat ─────► Ollama
                                     └── ai_jobs ──► Supabase
                                                        ▲
                                                        │ claim/resultado
                                                   Worker Python ──► Ollama
```

### Fluxo de chat pretendido

1. Navegador obtém a sessão Supabase.
2. Envia mensagem, conversa e token ao gateway.
3. Gateway valida sessão e carrega contexto autorizado.
4. Ollama produz resposta em streaming.
5. Frontend exibe os deltas.
6. Usuário e assistente são persistidos.
7. Memórias duráveis podem ser sugeridas para revisão.

Hoje, 1–4 existem em partes separadas; frontend e persistência da resposta ainda faltam.

### Fluxo assíncrono pretendido

1. Frontend cria pedido com UUID de idempotência.
2. Gateway grava `ai_jobs`.
3. Worker reivindica e executa.
4. Resultado é validado e armazenado.
5. Frontend acompanha o status.
6. Usuário revisa e confirma.
7. Resultado vira plano, versão, resumo ou memória.

O backend cobre 1–4 parcialmente. Faltam integração, validação específica e confirmação/promoção.

## 6. Segurança e riscos

### Crítico

`audit_events` ficou fora do bloco que habilita RLS e não recebe política própria. Antes de usar em produção, uma nova migration deve habilitar RLS; leitura deve ser limitada ao proprietário e gravação operacional pode ficar restrita ao backend.

### Outros pontos

- proteger páginas privadas no servidor/middleware;
- criar rate limiting e cotas;
- definir retenção, exportação e exclusão de dados;
- impedir conteúdo sensível em logs e prompts;
- registrar ações sensíveis em auditoria;
- documentar rotação e armazenamento de segredos;
- validar origem/CORS por ambiente;
- testar RLS com proprietário e usuário externo.

A `SUPABASE_SERVICE_ROLE_KEY` deve existir somente no gateway/worker. Chaves `NEXT_PUBLIC_*` são públicas por definição.

## 7. Configuração local

Pré-requisitos: Node.js 22.13+, npm, Docker/Compose e um projeto Supabase.

```bash
npm install
npm run dev
docker compose up --build
docker compose exec ollama ollama pull qwen3:8b
docker compose exec ollama ollama pull qwen3:4b
```

Antes disso, aplique em ordem as migrations de `supabase/migrations/` e configure um `.env` baseado em `.env.example`.

| Variável | Uso | Sensível |
|---|---|---:|
| `NEXT_PUBLIC_SUPABASE_URL` | Frontend | Não |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Frontend | Não |
| `NEXT_PUBLIC_AI_GATEWAY_URL` | Frontend; ainda não usada | Não |
| `SUPABASE_URL` | Gateway/worker | Não |
| `SUPABASE_SERVICE_ROLE_KEY` | Gateway/worker | **Sim** |
| `OLLAMA_BASE_URL` | Gateway/worker | Não |
| `OLLAMA_MAIN_MODEL` | Modelo principal | Não |
| `OLLAMA_LIGHT_MODEL` | Configurado, ainda não usado | Não |
| `ALLOWED_ORIGINS` | CORS | Não |

Sem configuração pública do Supabase, a interface abre em modo demonstrativo, sem autenticação ou persistência real.

## 8. O que falta para o MVP

### P0 — segurança e coerência

- corrigir RLS de auditoria;
- decidir a estratégia única de autenticação;
- publicar Termos e Política de Privacidade;
- proteger rotas no servidor;
- separar ambientes e segredos;
- decidir/remover D1/Drizzle;
- definir hospedagem de gateway, worker e Ollama.

### P1 — integração central

- trocar dados fictícios por consultas Supabase;
- carregar perfil real e adicionar logout;
- CRUD de conteúdo e tarefas;
- conectar chat SSE e persistir assistente;
- mostrar estado do modelo e dos jobs;
- promover somente resultados confirmados;
- implementar loading, erro, vazio e reconexão.

### P1 — jornada do criador

- onboarding de nicho, plataformas, metas, recursos e disponibilidade;
- planejamento semanal;
- calendário real;
- geração, edição e versionamento de roteiro;
- confirmação antes de agenda/memória;
- registro de publicação e métricas;
- revisão de memórias sugeridas.

### P2 — confiabilidade

- schemas Pydantic/TypeScript por operação;
- logs, métricas e correlação por job;
- recuperação de jobs presos;
- rate limiting e cotas;
- testes unitários, integração, RLS e E2E;
- CI com lint, build e testes;
- backup, retenção e exclusão de conta.

## 9. O que podemos criar

### Planejamento inteligente

Capacidade semanal em minutos, detecção de conflitos, gravação em lote por local/equipamento, “semana corrida”, banco de ideias para janelas livres e explicação de cada sugestão.

### Estúdio de conteúdo

Pacote com gancho, cenas, falas, B-roll, legenda, CTA, hashtags, teleprompter, checklist, anexos, variações por plataforma, comparação de versões e bloqueio de campos que a IA não pode alterar.

### Memória controlada

Caixa de entrada de sugestões, fonte de cada memória, confirmação/rejeição/expiração, conversa privada sem extração, exportação/exclusão e aviso quando uma recomendação usa uma memória.

### Métricas e aprendizado

Importação manual/CSV, integrações oficiais quando viáveis, comparação por formato/tema/gancho/horário, confiança estatística, esforço versus resultado, retrospectiva semanal e recomendação baseada no histórico pessoal.

### Tendências rastreáveis

Fontes permitidas, data e expiração, separação entre evidência/hipótese/recomendação, filtros por nicho/região/plataforma e aviso quando não houver evidência suficiente.

### Colaboração e negócio

Equipes, papéis, comentários, aprovação, múltiplas marcas, assinatura, painel administrativo, templates por nicho e produto para agências.

### IA e escala

Roteamento entre modelo leve/principal, fila priorizada, geração parcial, cache seguro, feedback de qualidade, fallback de modelos, guardrails e opção self-hosted ou provedor remoto com consentimento.

## 10. Roadmap sugerido

### Fase 1 — fundação segura

Corrigir RLS, alinhar autenticação/README, remover resíduos, definir contratos, CI e testes do banco.

### Fase 2 — vertical slice completo

Usuário entra, faz onboarding, cria uma ideia, gera um pacote, revisa, confirma e agenda. Esse fluxo deve vir antes de várias telas isoladas.

### Fase 3 — copiloto com memória

Chat conectado, histórico, resumos, mensagens completas, extração de memória, revisão, rastreabilidade e exclusão.

### Fase 4 — ciclo de aprendizado

Registro de publicação, métricas, metas, retrospectiva e uso de resultados no plano seguinte.

### Fase 5 — escala e monetização

Observabilidade, suporte, cobrança, filas robustas, equipes, integrações e estratégia de modelos.

## 11. Critérios de pronto do MVP

- conta e sessão funcionam;
- onboarding mínimo concluído;
- dashboard mostra dados do próprio usuário;
- contexto, disponibilidade e meta são editáveis;
- plano semanal pode ser gerado, revisado e confirmado;
- roteiro pode ser gerado, editado, versionado e agendado;
- chat possui histórico;
- usuário controla memórias;
- resultado de publicação pode ser registrado;
- RLS de todos os dados privados é testada;
- falhas de IA são recuperáveis e compreensíveis;
- jornada principal possui teste E2E.

## 12. Decisões em aberto

### Produto

- Quem é o primeiro usuário: criador, autônomo ou social media?
- Onboarding obrigatório ou progressivo?
- Planejamento, roteiro ou memória é o diferencial inicial?
- Métricas serão manuais no MVP?

### Tecnologia

- Ollama rodará em desenvolvimento, servidor próprio ou máquina do cliente?
- Frontend fará CRUD diretamente no Supabase?
- Haverá backend de domínio além do gateway de IA?
- Cloudflare/Vinext permanece definitivo?
- D1/Drizzle e ChatGPT Sign-In serão removidos?

### Privacidade

- Prazo de retenção de conversas e logs?
- Tipos de memória proibidos?
- Processo de exportação/exclusão?
- Fontes permitidas para tendências?
- Quais dados poderão ir a modelos remotos?

## 13. Dívida técnica priorizada

| Item | Impacto | Prioridade |
|---|---|---:|
| `audit_events` sem RLS | Exposição/alteração indevida | Crítica |
| Dashboard sem dados reais | Fluxo central indisponível | Alta |
| Chat visual simulado | Proposta principal incompleta | Alta |
| Assistente não persistido | Histórico incompleto | Alta |
| Saídas sem schema | Resultados frágeis | Alta |
| Jobs presos sem recuperação | Fila perde capacidade | Alta |
| Falhas sem telemetria | Diagnóstico incompleto | Alta |
| Proteção apenas no cliente | Segurança insuficiente | Alta |
| Cobertura de testes mínima | Regressões não detectadas | Alta |
| D1/Drizzle residual | Ambiguidade arquitetural | Média |
| Nome, datas e métricas fixos | Demo parece dado real | Média |
| Modelo leve sem uso | Complexidade ociosa | Baixa |

## 14. Estrutura do repositório

```text
app/                    frontend, login, dashboard e estilos
db/                     Drizzle/D1 residual, schema vazio
services/ai-gateway/    FastAPI, worker e imagem Docker
supabase/migrations/    domínio, RLS, fila e trigger
worker/                 entrada Cloudflare/Vinext
tests/                  smoke tests de HTML
examples/d1/            exemplo residual do template
docs/PROJETO.md         este documento
```

## 15. Próxima entrega recomendada

Construir um **fluxo vertical de conteúdo**:

1. autenticação real;
2. onboarding mínimo;
3. calendário vindo de `content_plans`;
4. criação manual de uma ideia;
5. geração assíncrona pelo gateway;
6. acompanhamento do job;
7. revisão e confirmação;
8. persistência em `content_versions`;
9. agendamento e exibição no dashboard.

Esse recorte usa quase toda a fundação existente, valida a proposta central e prepara memória, métricas e tendências.
