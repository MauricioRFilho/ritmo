# Biblioteca de modelos criativos do Ritmo

Esta pasta contém exemplos estruturados para orientar a IA. Eles são referências,
não textos para copiar e não garantem desempenho.

## Contrato

- `library.json` é o índice versionado.
- Arquivos sem `schema_version` são fixtures legadas v0 e permanecem intactos.
- Arquivos v1 usam um envelope com `schema_version`, `creative_type`, `metadata`,
  `constraints`, `creative`, `production` e `provenance`.
- O validador aceita v0 somente nos cinco arquivos legados conhecidos; novos modelos exigem v1.

## Modelos

- imagem publicitária;
- carrossel do Instagram;
- Reel/vídeo curto;
- vídeo educacional técnico;
- UGC/anúncio com criador;
- sketch de humor;
- demonstração de afiliado;
- carrossel de venda consultiva.

## Aprovação editorial

“Aprovado” significa aceito como referência editorial. “Validado por performance”
só pode ser usado após resultados reais de publicação; nenhum seed é tratado como
prova de desempenho.

Após o merge, o gateway sincroniza os modelos oficiais de forma idempotente no catálogo runtime do Supabase. A mesma chave e versão são imutáveis: JSON divergente bloqueia a sincronização. Adaptações carregam o modelo aprovado no servidor, preservam proveniência e exigem revisão humana; memória confirmada permanece separada do catálogo.
## Rotina diária com aprovação humana

1. A IA cria ou ajusta um arquivo JSON e atualiza `library.json`.
2. A alteração é publicada em uma branch `agent/*`, nunca diretamente na principal.
3. A PR executa o validador estrutural do catálogo.
4. Uma pessoa revisa objetivo, texto, alegações, direitos e aderência ao negócio.
5. Somente um merge realizado após revisão humana torna o modelo parte do catálogo oficial.

Para enforcement, a branch principal ainda precisa ter proteção externa com revisão de
Code Owners e o check `Creative model review` configurado como obrigatório.

Para validar antes de abrir a PR:

```bash
npm run validate:creative-models
```

O merge aprova o modelo editorialmente, não comprova sua performance. Resultados
de publicação devem ser registrados separadamente antes de alterar o estado para
`performance_validated`.
## Guardrails

- não inventar depoimentos, resultados, descontos, fontes ou credenciais;
- benefícios comerciais precisam de prova ou `evidence_required`;
- UGC publicitário registra disclosure e direitos;
- vídeos calculam a duração pela soma das cenas;
- carrosséis sequenciais mantêm a ordem;
- novas gerações usam padrões, nunca cópia literal do exemplo aprovado.

## Referências oficiais

- Meta — Reels ads: https://www.facebook.com/business/ads/facebook-instagram-reels-ads
- Meta — Carousel ads: https://www.facebook.com/business/ads/carousel-ad-format
- TikTok — Creative best practices: https://ads.tiktok.com/help/article/creative-best-practices?lang=en
- TikTok — UGC comercial: https://ads.tiktok.com/business/library/en_US_Commercial_UGC.pdf
- Google Ads — Creative guidance: https://support.google.com/google-ads/answer/13812351
- YouTube — Audience retention: https://support.google.com/youtube/answer/9314415


