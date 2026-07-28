# Integração contínua

O workflow `.github/workflows/ci.yml` executa em pull requests e pushes para
`main`.

## Job `code`

- Node 22.13;
- Python 3.13;
- instalação reproduzível por `npm ci`;
- dependências do gateway;
- lint;
- compilação e testes Python;
- build Vinext;
- testes Node de rotas e contratos.

## Job `database`

- Supabase CLI 2.75.0;
- stack local descartável;
- aplicação de todas as migrations;
- 23 testes pgTAP/RLS e do executor de privacidade.

Os jobs são independentes para tornar a causa da falha explícita. Uma execução
mais nova cancela a anterior na mesma branch.

## Proteção recomendada da branch

Ao conectar o repositório ao GitHub, exigir os checks:

- `Code, build and contracts`;
- `Migrations and RLS`.

Bloquear merge direto em `main`, exigir pelo menos uma revisão e impedir merge
com checks pendentes ou falhos.

## Promoção

CI verde autoriza staging, não produção. A promoção pública exige também o E2E
autenticado, restore, alertas, rollback e aprovações listadas em `GO-LIVE.md`.
