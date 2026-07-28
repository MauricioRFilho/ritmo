# Estratégia e evidências de testes

## Gate de código

```bash
npm run check
```

Executa lint, build, 8 testes Python e 16 testes Node de rotas e contratos.
Resultado mais recente: **24/24 passaram**.

## Gate de banco

```bash
npm run test:db
```

Executa três arquivos pgTAP: **23/23 passaram**. A suíte prova políticas,
índices, privilégios e isolamento real de leitura/escrita entre dois usuários.

Para recriar todo o banco antes do gate:

```bash
supabase start
supabase db reset
npm run test:db
```

## Gate local completo

```bash
npm run check:release
```

Requer Supabase local ativo e executa código + banco.

## Cobertura atual

- rotas de dashboard, login, Termos, Privacidade e controles de dados;
- ausência dos dados fictícios originais;
- onboarding, ideia, geração, versionamento e agenda;
- streaming e persistência do chat;
- schemas válidos/inválidos;
- recuperação e cancelamento de jobs;
- executor de exclusão com claim, retry e privilégio restrito;
- correlação e logs sem payload/token;
- RLS e isolamento entre usuários.

## Casos integrados ainda obrigatórios

- token ausente, expirado e de outro usuário no gateway;
- idempotência repetida e cota;
- Ollama indisponível e timeout;
- retry, job abandonado e cancelamento;
- interrupção de SSE;
- persistência completa da resposta.

## Jornada E2E obrigatória em staging

1. criar conta e aceitar termos;
2. concluir onboarding em hobby, profissional e equipe;
3. criar ideia;
4. gerar conteúdo e acompanhar job;
5. editar, confirmar uma versão e agendar;
6. registrar publicação e métricas;
7. conversar e revisar uma memória;
8. exportar dados e solicitar exclusão.

O teste usa usuário exclusivo, captura IDs de correlação e limpa somente dados
desse usuário.

## Histórico

| Data | Escopo | Código | Banco/RLS | E2E real | Veredito |
|---|---|---|---|---|---|
| 27/07/2026 | fundação | 8/8 | não executado | não implementado | bloquear |
| 27/07/2026 | vertical slice | 13/13 | 15/15 | pendente de staging | aprovar staging |
| 27/07/2026 | gate local final | 24/24 | 23/23 | pendente de infraestrutura | aprovar staging |
