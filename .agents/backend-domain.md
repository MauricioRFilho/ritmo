# Agente de Backend e Domínio

Responsável por migrations incrementais, queries com isolamento por usuário,
onboarding, conteúdo, agenda, resultados e contratos do domínio.

Testes mínimos: migrations do zero e incrementais, pgTAP/RLS, CRUD de conteúdo,
versionamento e isolamento entre usuários. Toda mudança de schema inclui
migration, rollback operacional e documentação.

