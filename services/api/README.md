# @voxa/api

API REST do Voxa ([Fastify](https://fastify.dev) 5 + [Zod](https://zod.dev)). Todas as rotas ficam sob `/api/v1` e usam os contratos de [`@voxa/protocol`](../../packages/protocol).

## Rodando

Com a infraestrutura de pé (`pnpm dev:infra`) e o `.env` criado (`cp .env.example .env`, na raiz):

```bash
pnpm --filter @voxa/api dev            # http://127.0.0.1:3000, recarrega ao salvar
curl localhost:3000/api/v1/health
```

O `dev` usa o **`node --watch` nativo**: o Node 24 executa o TypeScript diretamente, removendo os tipos. Por isso o código só pode usar sintaxe "apagável" (sem `enum`, `namespace` ou *parameter properties*), e o `typecheck` acusa se alguém usar (`erasableSyntaxOnly`).

Em produção: `pnpm --filter @voxa/api build && node services/api/dist/main.js`.

## Configuração

Lida das variáveis de ambiente e **validada na inicialização**: se faltar algo, a API não sobe e lista as variáveis com problema, sem mostrar os valores. Fora de produção, o `.env` da raiz é carregado automaticamente.

| Variável | Padrão | Descrição |
|---|---|---|
| `NODE_ENV` | `development` | `development`, `test` ou `production` (em dev, os logs saem formatados) |
| `API_HOST` / `API_PORT` | `127.0.0.1` / `3000` | Endereço de escuta |
| `LOG_LEVEL` | `info` | Nível do log (pino) |
| `DATABASE_URL`, `VALKEY_URL` | — | Postgres e Valkey |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | — | Armazenamento S3 |
| `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | — | LiveKit (segredo com 32+ caracteres) |

## `GET /api/v1/health`

Verifica Postgres (`select 1`), Valkey (`PING`), S3 (`HeadBucket`) e LiveKit (`ListRooms`) **em paralelo**, cada um com limite de 2 s.

- **200** quando tudo está `ok`.
- **503** quando alguma dependência falha, indicando qual e o motivo resumido (ex.: `ECONNREFUSED`, `timeout após 2000 ms`). O motivo nunca traz a mensagem completa do erro, que pode conter URLs e credenciais.

```json
{
  "status": "error",
  "version": "0.0.0",
  "uptime_s": 11,
  "checks": {
    "postgres": { "status": "error", "latency_ms": 8.1, "error": "ECONNREFUSED" },
    "valkey": { "status": "ok", "latency_ms": 4.8 },
    "s3": { "status": "ok", "latency_ms": 10 },
    "livekit": { "status": "ok", "latency_ms": 8.9 }
  }
}
```

## Erros

Todas as respostas de erro seguem o formato padrão `{ "error": { "code", "message", "details?" } }`:

| Situação | HTTP | `code` |
|---|---|---|
| Corpo, parâmetros ou query fora do esquema Zod | 400 | `VALIDATION_FAILED` (com `details.issues`) |
| Rota inexistente | 404 | `NOT_FOUND` |
| Limite de requisições | 429 | `RATE_LIMITED` |
| Erro inesperado | 500 | `INTERNAL_ERROR` (detalhes só no log, nunca na resposta) |

## Logs e privacidade

- JSON estruturado (pino); formatado com `pino-pretty` em desenvolvimento.
- Requisições aparecem só com **método, caminho (sem query string) e IP truncado** (/24 no IPv4, /48 no IPv6).
- `Authorization`, `Cookie` e `Set-Cookie` são substituídos por `[oculto]`.

## Encerramento

Em `SIGTERM`/`SIGINT`, a API para de aceitar requisições, espera as que estão em andamento e fecha Postgres, Valkey e S3. Se algo travar, encerra à força após 10 s.

## Testes

```bash
pnpm --filter @voxa/api test:unit          # unitários (src/), sem Docker
pnpm --filter @voxa/api test:integration   # integração (test/integration/), requer pnpm dev:infra
pnpm --filter @voxa/api test               # todos
```

- **Unitários** (`src/**/*.test.ts`): configuração, verificações, erros e `/health` com dependências simuladas.
- **Integração** (`test/integration/`): `/health` com as dependências reais via `fastify.inject`. Pulado em `test` quando não há `.env`; em `test:integration`, falha com instruções.
