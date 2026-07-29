# Correção CORS do gateway — 29/07/2026

## Incidente

O frontend publicado em
`https://ritmo-criador.mauricio-srfh.chatgpt.site` alcançava o gateway correto,
mas o preflight de `POST /v1/content/generate` era bloqueado por CORS.

## Causa

O arquivo `.env.staging` da VPS continha uma definição atualizada de
`ALLOWED_ORIGINS`, porém o container do gateway continuava com
`http://localhost:3000`.

O Compose usa `${ENV_FILE:-.env.example}` em `services.gateway.env_file`.
`--env-file .env.staging` sozinho não define `ENV_FILE`, e `restart` não
recarrega variáveis de ambiente.

## Correção

- consolidada uma única definição de `ALLOWED_ORIGINS` com a origem exata do
  Sites;
- criado backup privado do arquivo de ambiente anterior;
- recriado somente o container `gateway`, com `ENV_FILE=.env.staging`;
- demais containers preservados.

## Evidências

- gateway recriado e saudável;
- variável efetiva no container:
  `ALLOWED_ORIGINS=https://ritmo-criador.mauricio-srfh.chatgpt.site`;
- preflight direto na origem → `200`;
- preflight público HTTPS → `200`;
- `Access-Control-Allow-Origin` corresponde exatamente à origem do Sites;
- `Access-Control-Allow-Credentials: true`;
- métodos `GET, POST` e headers `authorization`, `content-type` e
  `idempotency-key` permitidos;
- origem negativa `https://example.invalid` → `400`, sem
  `Access-Control-Allow-Origin`.

## Veredito

**APROVAR o gate CORS do gateway.**

Permanece como smoke funcional do usuário repetir a geração com uma sessão
autenticada no frontend.
