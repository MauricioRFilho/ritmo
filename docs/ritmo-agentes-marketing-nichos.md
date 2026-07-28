# Ritmo — Agentes de Execução, Marketing e Schemas de Nicho

> Complementa `plano-ritmo-go-live.md`. Este documento define (1) os agentes responsáveis por executar cada fase do plano, (2) o plano de marketing até o Go Live e (3) schemas prontos de nicho para alimentar a taxonomia de conteúdo do produto.

---

## 1. Agentes de execução do plano

Cada agente pode ser uma pessoa, uma squad ou um agente de IA (ex.: subagente do Claude Code) responsável por um domínio. Todos reportam ao **Agente Coordenador**, que garante que nada avança sem passar pelos critérios de saída de cada fase.

### 1.1 Agente Coordenador (Orquestração)

- **Objetivo:** manter o roadmap sincronizado, decidir prioridades entre agentes, aprovar transição de fase.
- **Entradas:** status de cada agente, riscos abertos, decisões pendentes (seção 4 do plano de Go Live).
- **Saídas:** atualização do roadmap, priorização semanal, registro de decisões fechadas.
- **Critério de conclusão:** todas as fases fechadas com critério de saída cumprido; checklist de lançamento 100% marcado.

### 1.2 Agente de Segurança & Infraestrutura

- **Fase principal:** 1 (Fundação segura); suporte contínuo nas fases seguintes.
- **Responsabilidades:**
  - corrigir RLS de `audit_events` e auditar RLS de todas as tabelas privadas;
  - unificar estratégia de autenticação (remover código/README residual);
  - publicar Termos e Política de Privacidade;
  - proteger rotas no servidor/middleware;
  - separar ambientes e segredos (dev/staging/produção);
  - definir hospedagem de gateway, worker e Ollama.
- **Saídas:** migrations de RLS, middleware de proteção de rota, documentação de ambientes.
- **Critério de conclusão:** nenhuma pendência de segurança crítica ou alta em aberto.

### 1.3 Agente de Backend/Domínio (Supabase)

- **Fase principal:** 2, com extensões nas fases 4 e 5.
- **Responsabilidades:**
  - expor dados reais de `content_plans`, `weekly_plans`, `creator_goals` para substituir os dados fictícios do frontend;
  - CRUD de conteúdo e tarefas;
  - schema/taxonomia de nicho em `creator_preferences` (ver seção 3);
  - schema de "modo de conta" (hobby/profissional/equipe);
  - suporte a `publication_results` e `metric_snapshots` na fase 4.
- **Saídas:** endpoints/queries de domínio, migrations incrementais, documentação de schema.
- **Critério de conclusão:** dashboard e calendário consomem 100% dados reais; nenhuma constante fictícia no frontend.

### 1.4 Agente de Gateway de IA (FastAPI/Worker/Ollama)

- **Fase principal:** 2 e 3.
- **Responsabilidades:**
  - conectar `/v1/content/generate` e `/v1/plans/generate` ao frontend com acompanhamento de job;
  - conectar `/v1/chat/stream` (fim da resposta fixa);
  - persistir resposta do assistente;
  - implementar schemas Pydantic por operação;
  - recuperação de jobs presos em `running`, retry e cancelamento em execução;
  - roteamento entre modelo leve (`qwen3:4b`) e principal (`qwen3:8b`).
- **Saídas:** endpoints funcionais, schemas validados, logs estruturados por job.
- **Critério de conclusão:** nenhuma chamada de IA sem schema; taxa de jobs presos = 0 em monitoramento.

### 1.5 Agente de Frontend/Produto

- **Fase principal:** 2, com extensões em todas as fases seguintes.
- **Responsabilidades:**
  - onboarding mínimo (nicho, plataforma, modo de conta, disponibilidade);
  - estados de carregamento, erro e vazio;
  - logout visível, perfil real;
  - telas de "Minha semana", "Conteúdos", "Memórias", "Meu contexto" (hoje só banco, sem tela);
  - UI adaptativa por modo de conta (hobby vs. profissional vs. equipe).
- **Saídas:** telas funcionais conectadas ao backend real.
- **Critério de conclusão:** todos os módulos do "Mapa funcional" (seção 3 do PROJETO.md) saem do estado "interface estática/demonstrativa".

### 1.6 Agente de Copiloto & Memória

- **Fase principal:** 3.
- **Responsabilidades:**
  - histórico de conversa persistido e exibido;
  - extração de memórias sugeridas com caixa de entrada de revisão;
  - rastreabilidade (avisar quando uma recomendação usa uma memória);
  - exportação/exclusão de memórias e conversas.
- **Saídas:** fluxo de memória completo, testado com usuários reais.
- **Critério de conclusão:** usuário consegue ver, aceitar, rejeitar e excluir qualquer memória usada pelo copiloto.

### 1.7 Agente de Dados & Métricas

- **Fase principal:** 4.
- **Responsabilidades:**
  - registro manual/CSV de publicação e métricas;
  - comparação por formato/tema/gancho/horário com confiança estatística mínima;
  - retrospectiva semanal;
  - realimentação do histórico no plano seguinte;
  - métricas configuráveis por objetivo do modo de conta (alcance, conversão, consistência).
- **Saídas:** dashboards de desempenho, relatório de retrospectiva.
- **Critério de conclusão:** recomendações do copiloto citam dado histórico real do próprio usuário.

### 1.8 Agente de QA & Confiabilidade

- **Fase principal:** transversal, intensifica na fase 5.
- **Responsabilidades:**
  - testes unitários, integração, RLS e E2E da jornada principal;
  - CI com lint, build e testes;
  - rate limiting e cotas;
  - observabilidade (logs, métricas, correlação por job);
  - backup, retenção e exclusão de conta.
- **Saídas:** pipeline de CI verde, cobertura mínima definida, alertas configurados.
- **Critério de conclusão:** jornada principal com teste E2E passando; sem regressão não detectada em produção por 2 ciclos de release.

### 1.9 Agente de Produto/Nicho

- **Fase principal:** inicia na 2 (taxonomia básica), consolida na 5 (expansão de públicos).
- **Responsabilidades:**
  - manter e expandir os schemas de nicho (seção 3);
  - validar templates de roteiro por nicho com criadores reais;
  - priorizar quais nichos entram em cada release;
  - adaptar UI/copiloto por modo de conta.
- **Saídas:** biblioteca de schemas de nicho, relatório de validação com criadores piloto.
- **Critério de conclusão:** pelo menos 3 nichos validados com criadores reais antes do Go Live.

### 1.10 Agente de Marketing & Growth

- **Fase principal:** inicia em paralelo à Fase 2, intensifica nas Fases 4-5.
- **Responsabilidades:** ver seção 2 completa.
- **Saídas:** waitlist, conteúdo de lançamento, parcerias com criadores piloto, métricas de aquisição.
- **Critério de conclusão:** meta de usuários ativos na primeira semana pós-Go Live atingida (definir número junto ao Coordenador).

### 1.11 Matriz de dependência por fase

| Fase | Agentes principais | Agentes de suporte |
|---|---|---|
| 1 — Fundação segura | Segurança & Infra | Coordenador |
| 2 — Vertical slice | Backend, Gateway de IA, Frontend | Produto/Nicho, QA |
| 3 — Copiloto com memória | Copiloto & Memória, Gateway de IA | Frontend, QA |
| 4 — Ciclo de aprendizado | Dados & Métricas | Backend, Marketing |
| 5 — Escala e públicos | QA & Confiabilidade, Produto/Nicho | Marketing, Backend |
| Transversal | Coordenador, Marketing | Todos |

---

## 2. Plano de marketing até o Go Live

### 2.1 Posicionamento por segmento

| Segmento | Mensagem central | Prova de valor |
|---|---|---|
| Amador/hobbista | "Mantenha o ritmo sem se sobrecarregar" | Consistência semanal sem esforço de planejamento |
| Profissional solo | "Transforme métricas em decisão de conteúdo" | Retrospectiva e recomendação baseada no próprio histórico |
| Equipe/agência | "Produção de conteúdo em escala, com controle" | Aprovação, papéis e múltiplas marcas em um só lugar |

### 2.2 Fases de marketing (espelhando o roadmap de produto)

**Durante Fase 1-2 (pré-lançamento):**
- landing page com proposta de valor e captura de waitlist;
- conteúdo educativo (o próprio Ritmo documentando seu processo de construção — "eat your own dogfood");
- recrutamento de 10-20 criadores piloto (mix de amador/profissional) para validar onboarding e Estúdio de conteúdo.

**Durante Fase 3 (beta fechado):**
- convite da waitlist em lotes, priorizando os nichos já validados (seção 3);
- coleta estruturada de feedback do copiloto e da memória;
- primeiros depoimentos/case de criadores piloto (com consentimento explícito).

**Durante Fase 4 (beta aberto / pré-Go Live):**
- conteúdo de resultado real: "como um criador foi de X para Y usando retrospectiva do Ritmo";
- parcerias com micro-influenciadores dos nichos-alvo (esporte/corrida, beauty, etc.) como early adopters, não como publicidade paga inicialmente;
- programa de indicação simples (criador convida criador).

**Durante Fase 5 (Go Live):**
- lançamento público com cronograma de conteúdo (anúncio, tutorial, bastidores);
- ativação de modo de conta "equipe/agência" como motor de upsell;
- métricas de aquisição por canal (orgânico, indicação, parceria).

### 2.3 Canais prioritários

- TikTok e Instagram do próprio Ritmo — coerente com a proposta do produto, serve como prova viva;
- comunidades de criadores (Discord/Telegram/grupos de nicho);
- parcerias diretas com criadores piloto por nicho, priorizando os schemas já validados;
- conteúdo educativo em formato curto (o mesmo formato que o produto ajuda a criar).

### 2.4 Métricas de marketing a acompanhar

- tamanho e taxa de conversão da waitlist;
- ativação (% que completa onboarding e gera o primeiro conteúdo);
- retenção em 7/30 dias por modo de conta;
- CAC por canal (mesmo que qualitativo no início — só pago quando houver orçamento);
- NPS ou satisfação dos criadores piloto por nicho.

### 2.5 Riscos de marketing

- lançar para múltiplos nichos antes de ter templates validados gera experiência rasa — por isso o Agente de Marketing depende do Agente de Produto/Nicho ter pelo menos 3 nichos validados antes de abrir aquisição paga;
- prometer resultado de alcance/viralização contradiz o princípio de "honestidade sobre alcance" do produto — toda comunicação deve focar em consistência e decisão baseada em dado, não em promessa de crescimento.

---

## 3. Schemas de nicho prontos

Estrutura pensada para alimentar `creator_preferences` (campo de taxonomia) e os templates do Estúdio de conteúdo. Cada nicho segue o mesmo formato, o que permite adicionar novos nichos sem alterar código — só dados.

### 3.1 Formato base (schema)

```json
{
  "niche_id": "string (slug único)",
  "nome": "string",
  "categoria_pai": "string | null (ex: esporte > corrida)",
  "plataformas_prioritarias": ["tiktok", "instagram", "youtube_shorts"],
  "formatos_de_gancho": ["string"],
  "estrutura_de_roteiro_padrao": ["string (nomes das cenas em ordem)"],
  "cta_tipicos": ["string"],
  "hashtags_padrao": ["string"],
  "kpis_prioritarios": ["string"],
  "equipamentos_tipicos": ["string"],
  "tom_de_voz_sugerido": "string",
  "exemplos_de_ideias": ["string"]
}
```

### 3.2 Nicho: Influenciador geral / lifestyle

```json
{
  "niche_id": "influencer-geral",
  "nome": "Influenciador / Lifestyle geral",
  "categoria_pai": null,
  "plataformas_prioritarias": ["tiktok", "instagram"],
  "formatos_de_gancho": [
    "pergunta direta ao público",
    "afirmação polêmica/contraintuitiva",
    "\"não faça isso antes de...\""
  ],
  "estrutura_de_roteiro_padrao": ["gancho", "contexto pessoal", "desenvolvimento", "CTA"],
  "cta_tipicos": ["seguir para mais", "comentar experiência", "compartilhar com alguém que precisa ver"],
  "hashtags_padrao": ["#diaadia", "#lifestyle", "#rotina"],
  "kpis_prioritarios": ["alcance", "salvamentos", "compartilhamentos"],
  "equipamentos_tipicos": ["celular", "microfone de lapela", "iluminação básica"],
  "tom_de_voz_sugerido": "próximo, autêntico, conversacional",
  "exemplos_de_ideias": ["dia na minha vida", "3 hábitos que mudaram minha rotina"]
}
```

### 3.3 Nicho: Esporte (geral)

```json
{
  "niche_id": "esporte-geral",
  "nome": "Esporte (geral)",
  "categoria_pai": null,
  "plataformas_prioritarias": ["instagram", "tiktok", "youtube_shorts"],
  "formatos_de_gancho": [
    "resultado/transformação em números",
    "erro comum que atrapalha performance",
    "desafio ao vivo"
  ],
  "estrutura_de_roteiro_padrao": ["gancho", "demonstração/execução", "explicação técnica", "CTA"],
  "cta_tipicos": ["salvar para treinar depois", "marcar parceiro de treino", "seguir para série completa"],
  "hashtags_padrao": ["#treino", "#esporte", "#performance"],
  "kpis_prioritarios": ["salvamentos", "tempo de retenção", "alcance"],
  "equipamentos_tipicos": ["celular com estabilização", "tripé", "roupa/local de treino"],
  "tom_de_voz_sugerido": "motivador, direto, tecnicamente confiável",
  "exemplos_de_ideias": ["3 erros que travam sua evolução", "rotina de aquecimento em 60s"]
}
```

### 3.4 Nicho: Corrida (subcategoria de esporte)

```json
{
  "niche_id": "corrida",
  "nome": "Corrida / Running",
  "categoria_pai": "esporte-geral",
  "plataformas_prioritarias": ["instagram", "tiktok", "youtube_shorts"],
  "formatos_de_gancho": [
    "tempo/pace como prova social",
    "\"o que eu faria diferente se começasse hoje\"",
    "mito sobre corrida desmentido"
  ],
  "estrutura_de_roteiro_padrao": ["gancho", "contexto da corrida/treino", "dica técnica", "CTA"],
  "cta_tipicos": ["salvar plano de treino", "comentar seu pace atual", "seguir para série de preparação"],
  "hashtags_padrao": ["#corrida", "#running", "#maratona"],
  "kpis_prioritarios": ["salvamentos", "comentários com dúvidas técnicas", "alcance"],
  "equipamentos_tipicos": ["relógio GPS", "celular", "app de corrida para captura de dados"],
  "tom_de_voz_sugerido": "encorajador, baseado em dado, comunidade",
  "exemplos_de_ideias": ["evolução de pace em 8 semanas", "erro de pisada que causa lesão"]
}
```

### 3.5 Nicho: Maquiagem / Beauty

```json
{
  "niche_id": "maquiagem-beauty",
  "nome": "Maquiagem / Beauty",
  "categoria_pai": null,
  "plataformas_prioritarias": ["tiktok", "instagram", "youtube_shorts"],
  "formatos_de_gancho": [
    "antes/depois",
    "produto subestimado/superestimado",
    "\"truque que ninguém te conta\""
  ],
  "estrutura_de_roteiro_padrao": ["gancho", "produtos usados", "passo a passo", "resultado final", "CTA"],
  "cta_tipicos": ["salvar o passo a passo", "comentar qual produto testar", "seguir para mais tutoriais"],
  "hashtags_padrao": ["#maquiagem", "#beauty", "#makeuptutorial"],
  "kpis_prioritarios": ["salvamentos", "tempo de retenção", "compartilhamentos"],
  "equipamentos_tipicos": ["iluminação de anel", "celular com boa câmera macro", "produtos de maquiagem"],
  "tom_de_voz_sugerido": "próximo, didático, entusiasmado",
  "exemplos_de_ideias": ["maquiagem em 5 minutos", "dupe de produto caro"]
}
```

### 3.6 Nicho: Culinária

```json
{
  "niche_id": "culinaria",
  "nome": "Culinária",
  "categoria_pai": null,
  "plataformas_prioritarias": ["instagram", "tiktok", "youtube_shorts"],
  "formatos_de_gancho": [
    "prato pronto em destaque",
    "ingrediente surpreendente",
    "receita em X minutos"
  ],
  "estrutura_de_roteiro_padrao": ["gancho (prato pronto)", "ingredientes", "modo de preparo", "resultado final", "CTA"],
  "cta_tipicos": ["salvar receita", "comentar variação", "seguir para mais receitas"],
  "hashtags_padrao": ["#receita", "#culinaria", "#comidacaseira"],
  "kpis_prioritarios": ["salvamentos", "compartilhamentos", "alcance"],
  "equipamentos_tipicos": ["celular", "iluminação de cozinha", "tripé de bancada"],
  "tom_de_voz_sugerido": "caseiro, acessível, apetitoso",
  "exemplos_de_ideias": ["jantar em 15 minutos", "substituto saudável de ingrediente comum"]
}
```

### 3.7 Nicho: Negócios / Educação financeira

```json
{
  "niche_id": "negocios-educacao-financeira",
  "nome": "Negócios / Educação financeira",
  "categoria_pai": null,
  "plataformas_prioritarias": ["instagram", "tiktok", "linkedin"],
  "formatos_de_gancho": [
    "número/estatística surpreendente",
    "erro financeiro comum",
    "\"o que ninguém te ensina sobre...\""
  ],
  "estrutura_de_roteiro_padrao": ["gancho", "problema", "explicação/dado", "recomendação prática", "CTA"],
  "cta_tipicos": ["salvar para reler", "comentar experiência", "seguir para série completa"],
  "hashtags_padrao": ["#educacaofinanceira", "#negocios", "#empreendedorismo"],
  "kpis_prioritarios": ["salvamentos", "comentários com dúvidas", "conversão para link/produto"],
  "equipamentos_tipicos": ["celular", "microfone de lapela", "apresentação/slide simples"],
  "tom_de_voz_sugerido": "confiável, direto, didático",
  "exemplos_de_ideias": ["erro que te mantém no vermelho", "como comecei a investir com pouco"]
}
```

### 3.8 Como adicionar um novo nicho

1. Duplicar o formato base (seção 3.1);
2. Preencher com o Agente de Produto/Nicho, validando com pelo menos 1 criador real do nicho;
3. Gerar 2-3 ideias de exemplo com o Estúdio de conteúdo usando o schema;
4. Só liberar aquisição de marketing para o nicho depois da validação (ver seção 2.5).

---

## 4. Como este documento se conecta ao plano de Go Live

- Os agentes das seções 1.2 a 1.9 executam as Fases 1-5 descritas em `plano-ritmo-go-live.md`.
- O Agente de Marketing (1.10) roda em paralelo, mas depende do Agente de Produto/Nicho (1.9) ter nichos validados antes de escalar aquisição.
- Os schemas da seção 3 alimentam diretamente o item "taxonomia de nicho ausente" listado como risco de prioridade média no plano de Go Live, e são o insumo prático da generalização de público prevista para a Fase 5.
