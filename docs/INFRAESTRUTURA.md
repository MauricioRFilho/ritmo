# Infraestrutura de staging e produção

## Topologia

```text
Sites/Vinext
    │ HTTPS
    ├── Supabase Auth + Postgres
    │
    └── Gateway FastAPI
            ├── Supabase service role
            └── rede privada
                  ├── Worker
                  └── Ollama + volume persistente
```

O frontend nunca recebe `service_role`. Gateway e worker compartilham acesso ao
Supabase, mas somente o gateway publica HTTPS. Ollama não expõe porta pública.

## Staging provisionado

A VPS HostGator de staging possui Docker, Nginx, 3,8 GiB de RAM e não possui GPU. O gateway HTTPS está ativo em `https://ritmo-api.gapet.com.br` via Cloudflare, com CORS para o frontend atual. O ambiente usa modelo reduzido e não comprova capacidade de produção. DNS e TLS estão ativos; produção separada, alertas, restore e sizing continuam pendentes.

## Ambientes

| Item | Dev | Staging | Produção |
|---|---|---|---|
| Supabase | local | projeto próprio | projeto próprio |
| Gateway | localhost | URL privada de teste | URL pública TLS |
| Worker/Ollama | Docker local | host isolado | host isolado |
| Sites | local | acesso owner-only | política aprovada |
| Dados reais | proibido | dados sintéticos | permitido |

## Subida dos serviços

```bash
docker compose -f docker-compose.yml -f docker-compose.production.yml up -d --build
docker compose exec ollama ollama pull qwen3:8b
docker compose exec ollama ollama pull qwen3:4b
```

Defina `ENV_FILE` para o arquivo seguro do ambiente. Passar apenas
`docker compose --env-file ...` não altera o `env_file` dos serviços, pois essa
opção alimenta a interpolação do Compose. Exemplo:

```bash
ENV_FILE=.env.staging docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.production.yml up -d --build
```

Depois de alterar uma variável, recrie o serviço afetado; `restart` não recarrega
o ambiente:

```bash
ENV_FILE=.env.staging docker compose --env-file .env.staging \
  -f docker-compose.yml -f docker-compose.production.yml \
  up -d --force-recreate --no-deps gateway
```

Não use `.env.example` fora do desenvolvimento.

## Smoke operacional

```bash
curl --fail https://gateway.exemplo.com/v1/health
docker compose ps
docker compose logs --since=10m gateway worker
```

Depois, testar autenticação, criação de job, claim, conclusão e consulta pelo
mesmo usuário. Uma consulta por outro usuário deve retornar 404.

## Segredos

- `SUPABASE_SERVICE_ROLE_KEY`: gateway e worker;
- chaves públicas: frontend e gateway;
- credencial administrativa do host: cofre do time;
- nenhum segredo em imagem, repositório, log ou URL.

Rotação: imediatamente em vazamento ou troca de responsável e, no mínimo,
semestralmente. Registrar data, executor e serviços reiniciados.

## Capacidade inicial recomendada

- gateway: 1 CPU / 512 MB;
- worker: 1 CPU / 512 MB, sem contar o modelo;
- Ollama: GPU compatível, 12 GB de RAM/VRAM como ponto inicial a validar;
- volume de modelos: 30 GB;
- fila: alerta aos 5 minutos de idade.

Esses números são hipóteses. O teste de carga em staging define a capacidade
final e as cotas comerciais.
