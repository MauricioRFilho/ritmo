# Ritmo

Copiloto de conteúdo para criadores de TikTok e Instagram. O produto combina calendário, contexto pessoal, memória revisável, métricas e geração local de IA com Ollama.

## Componentes

- `app/`: frontend Next.js/Vinext, dashboard e autenticação.
- `supabase/migrations/`: schema PostgreSQL, índices, RLS e fila persistente.
- `services/ai-gateway/`: gateway FastAPI e worker assíncrono.
- `docker-compose.yml`: gateway, worker e Ollama em rede privada.

## Configuração

1. Crie um projeto no Supabase.
2. Execute a migration em `supabase/migrations/202607240001_initial_schema.sql`.
3. Copie `.env.example` para `.env` e preencha as chaves.
4. Configure Google OAuth no Supabase e inclua as URLs local e de produção.
5. Execute `npm run dev` para o frontend.
6. Execute `docker compose up --build` para IA.
7. Baixe os modelos: `docker compose exec ollama ollama pull qwen3:8b` e `qwen3:4b`.

Sem variáveis do Supabase, o frontend abre em modo de demonstração com dados fictícios.

## Segurança

A chave publishable pode ser usada no navegador. A `service_role` pertence somente ao gateway/worker e nunca deve ser commitada. O Ollama não publica porta para o host na configuração de produção e todas as tabelas privadas possuem RLS por `user_id`.

## Validação

```bash
npm run lint
npm run build
py -3 -m py_compile services/ai-gateway/app/main.py services/ai-gateway/app/worker.py
```
