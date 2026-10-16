# infra/docker

Dockerfiles das imagens de produção. O contexto de build é sempre a **raiz do repositório**.

| Arquivo | Imagem | Base |
|---|---|---|
| `servico.Dockerfile` | API, gateway e worker (escolhidos por `--build-arg PACOTE`) | `node:24.21.0-alpine` |
| `web.Dockerfile` + `web.Caddyfile` | App web estático na porta 80 | `caddy:2.11.4-alpine` |
| `saude.mjs` | `HEALTHCHECK` dos serviços Node | — |

## Construir localmente

```bash
# API
docker build -f infra/docker/servico.Dockerfile \
  --build-arg PACOTE=@voxa/api --build-arg PORTA_SAUDE=3000 --build-arg CAMINHO_SAUDE=/api/v1/health \
  -t voxa-api .

# gateway
docker build -f infra/docker/servico.Dockerfile \
  --build-arg PACOTE=@voxa/gateway --build-arg PORTA_SAUDE=4000 --build-arg CAMINHO_SAUDE=/health \
  -t voxa-gateway .

# worker (sem HTTP: o HEALTHCHECK só confirma que o processo responde)
docker build -f infra/docker/servico.Dockerfile --build-arg PACOTE=@voxa/worker -t voxa-worker .

# app web
docker build -f infra/docker/web.Dockerfile -t voxa-web .
```

## Como a imagem de um serviço é montada

1. **`turbo prune`** separa só os pacotes do monorepo de que o serviço depende.
2. `pnpm install` e `turbo run build` compilam esses pacotes.
3. **`pnpm deploy --prod`** monta uma pasta com o serviço (`dist/`) e só as dependências de produção.
4. A imagem final leva essa pasta e o Node, roda como o usuário `node` (sem privilégios) e escuta em `0.0.0.0`.

A configuração vem toda de variáveis de ambiente (as mesmas do `.env.example`, com `NODE_ENV=production`).

## Publicação

O workflow [`.github/workflows/release.yml`](../../.github/workflows/release.yml) constrói cada imagem em amd64 e arm64 (runners nativos) a cada merge na `main` e publica em `ghcr.io/devballao/voxa-<serviço>` com as tags `sha-<commit>` e `main`. Nos PRs, o CI só constrói (amd64), para pegar um Dockerfile quebrado antes do merge.

## Atualizar as imagens base

Troque a versão nos dois Dockerfiles, usando uma versão publicada há **pelo menos 14 dias** (a mesma regra das Actions, [Desenvolvimento §10.5](../../docs/10-desenvolvimento.md#105-cicd)).
