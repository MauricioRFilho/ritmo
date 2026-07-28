# Provisionamento da VPS de staging — 27/07/2026

## Ambiente

- host: VPS HostGator, Ubuntu 22.04;
- acesso: usuário temporário `codex-deploy`;
- Nginx 1.18 e Docker 29.1 / Compose 2.40;
- capacidade: 3,8 GiB de RAM, sem GPU;
- aplicação preexistente `radar.gapet.com.br` preservada.

## Serviços instalados

Em `/home/codex-deploy/ritmo`:

- gateway FastAPI, publicado somente em `127.0.0.1:8000`;
- worker de IA;
- worker de privacidade;
- Ollama em rede Docker interna, sem porta pública;
- modelo `qwen3:0.6b` (522 MB) para staging CPU.

O modelo foi baixado mediante conexão externa temporária do container. Após o
download, o Ollama voltou a permanecer somente na rede `ritmo_ai_private`.

## Banco remoto

Projeto Supabase `qctewsmcuvmmovjqoylr`:

- chave administrativa validada sem exposição;
- migrations `202607270001`, `202607270002` e `202607270003` aplicadas;
- `claim_ai_job`, recuperação de jobs e `claim_privacy_deletion` respondendo
  `200`.

## Nginx

- virtual host HTTP instalado para `ritmo-api.gapet.com.br`;
- configuração validada com `nginx -t`;
- backup anterior em
  `/home/codex-deploy/nginx-before-ritmo-20260727.tgz`;
- TLS aguarda criação/propagação do DNS.

## Evidências

- quatro containers ativos e estáveis;
- gateway saudável via Nginx: `GET /v1/health` → `200`;
- token inválido → `401`;
- preflight CORS da URL do Sites → `200` e origem permitida;
- inferência local com `qwen3:0.6b` concluída;
- uso observado após inferência: Ollama ~1,0 GiB; demais serviços <45 MiB;
- nenhum traceback ou resposta 4xx/5xx nos 90 segundos finais;
- Ollama sem conexão à rede pública após o pull;
- `sudo` sem senha temporário revogado após o provisionamento.

## Pendências externas

1. criar `A ritmo-api.gapet.com.br → 143.95.209.7`;
2. emitir TLS com Certbot após propagação;
3. definir `NEXT_PUBLIC_AI_GATEWAY_URL=https://ritmo-api.gapet.com.br` no Sites;
4. publicar a nova versão do frontend e executar E2E autenticado;
5. reativar privilégio temporário apenas para o Certbot e revogá-lo novamente;
6. após o handoff definitivo, remover o usuário temporário.
