# Biblioteca criativa e memória aprovada — 29/07/2026

## Objetivo

Transformar exemplos JSON heterogêneos em referências versionadas para a IA,
sem copiar criativos literalmente e sem transformar aprovação editorial em
alegação de performance.

## Decisões

- os cinco JSONs originais permanecem como fixtures legadas v0;
- `CreativeSpec v1` envolve o payload específico sem perda;
- `library.json` indexa a biblioteca;
- três seeds v1 ampliam humor, afiliado/UGC e venda consultiva;
- o worker escolhe referência por formato ou `creative_type` explícito;
- padrões aceitos são contexto, não conteúdo para copiar;
- o criativo completo vive em `content_versions`;
- aprovação cria versão, agenda e job de extração em uma única transação;
- a extração gera memórias `suggested`; somente `confirmed`/`pinned` retornam à
  geração.

## Fontes

Foram consultadas fontes oficiais de Meta, TikTok for Business, Google Ads e
YouTube. Os modelos adotam hook inicial, mensagem única, prova visual, CTA
coerente, safe zone, disclosure/direitos para UGC e estrutura passo a passo em
educação técnica. Referências completas estão em `modelos/README.md`.

## Testes

- JSONs do índice lidos e normalizados sem perda;
- seleção de referência por formato;
- aprovação transacional e rastreabilidade de `content_version`;
- bloqueio de execução anônima;
- somente memórias aprovadas alimentam novas gerações;
- lint, build, Node, Python e pgTAP.

## Estado

Aguardando QA final e promoção controlada para VPS, Supabase remoto e Sites.
