# @voxa/protocol

Contratos entre cliente e servidor do Voxa: esquemas [Zod](https://zod.dev) e os tipos derivados deles. É a **fonte única da verdade**: a API valida com estes esquemas, e o cliente usa os mesmos tipos. Se um campo mudar aqui, os dois lados deixam de compilar.

## Uso

```ts
import { API_BASE_PATH, GATEWAY_PATH, GATEWAY_VERSION } from "@voxa/protocol";
import { ErrorResponse, HealthResponse } from "@voxa/protocol/http";
import { ClientMessage, ServerMessage, type HelloMessage } from "@voxa/protocol/gateway";

const resposta = HealthResponse.parse(await res.json()); // valida e tipa
```

| Subcaminho | Conteúdo |
|---|---|
| `@voxa/protocol` | Tudo abaixo, mais as constantes de versão (`API_BASE_PATH`, `GATEWAY_PATH`…) |
| `@voxa/protocol/http` | `ErrorResponse` (erro padrão), `HealthResponse` (`GET /api/v1/health`) |
| `@voxa/protocol/gateway` | `GatewayEnvelope`, `HelloMessage`, `HeartbeatMessage`, `HeartbeatAckMessage`, `ServerMessage`, `ClientMessage` |

## Convenções

- Campos no fio em **`snake_case`** (`heartbeat_interval`, `latency_ms`).
- Cada esquema exporta um valor e um tipo com o mesmo nome (`HealthResponse` serve para `.parse()` e como tipo).
- Campos desconhecidos são **ignorados**, para que versões futuras do servidor possam acrescentar campos sem quebrar clientes antigos.
- Toda mudança em um esquema vem acompanhada de teste em `src/**/*.test.ts`. Meta de cobertura: 80% (ver [docs](../../docs/10-desenvolvimento.md#103-testes)).

## Desenvolvimento

```bash
pnpm --filter @voxa/protocol build   # gera dist/ (ESM + .d.ts) com tsc
pnpm --filter @voxa/protocol dev     # recompila a cada mudança
pnpm --filter @voxa/protocol test
```

Os consumidores importam do `dist/`, e o Turborepo compila este pacote antes deles (`dependsOn: ["^build"]`). O build usa o próprio `tsc`: o TypeScript 7 não tem a API usada por `tsup` e similares.
