# Evidência de gate — 27/07/2026

Escopo: fundação de Go Live.

## Resultado local

- ESLint: **passou**;
- compilação de `main.py` e `worker.py`: **passou**;
- schemas Python: **4/4 passaram**;
- build Vinext: **passou**;
- smoke HTML e rotas legais: **4/4 passaram**;
- pgTAP/RLS: **não executado**.

Comando executado:

```bash
npm run check
```

## Bloqueio do banco

O Supabase CLI está instalado (`2.75.0`), mas `supabase start` não concluiu em
duas janelas (180 s e 30 s) e nenhum container de banco ficou disponível. A
migration e o pgTAP foram revisados estaticamente, mas não devem ser marcados
como validados até execução em ambiente local ou staging.

## Veredito

`BLOQUEAR` abertura pública. O gate de código local está verde; banco,
infraestrutura, jornada real e dependências externas permanecem pendentes.
