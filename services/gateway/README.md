# @voxa/gateway

Gateway WebSocket do Voxa: mantém uma conexão por sessão e entrega eventos em tempo real ([Backend §4.6](../../docs/04-backend.md#46-gateway-protocolo-em-tempo-real)). Usa os contratos de [`@voxa/protocol/gateway`](../../packages/protocol).

> Estágio atual (Milestone 0): `HELLO`, heartbeat, `RECONNECT` e o canal de teste `dev:ping`. `IDENTIFY`, `READY`, `RESUME` e autenticação chegam no MVP.

## Rodando

Com `pnpm dev:infra` e o `.env` da raiz:

```bash
pnpm --filter @voxa/gateway dev       # ws://127.0.0.1:4000/gateway, recarrega ao salvar
curl localhost:4000/health
```

Para testar à mão com o [websocat](https://github.com/vi/websocat):

```bash
websocat ws://localhost:4000/gateway
# ← {"op":"HELLO","d":{"heartbeat_interval":41250}}
{"op":"HEARTBEAT","d":null}
# ← {"op":"HEARTBEAT_ACK","d":null}

# em outro terminal: publica um evento de teste para todos os clientes
docker compose -f infra/compose/docker-compose.dev.yml exec valkey valkey-cli PUBLISH dev:ping oi
# ← {"op":"DISPATCH","t":"DEV_PING","s":1,"d":{"message":"oi"}}
```

## Protocolo (estado atual)

| Situação | Comportamento |
|---|---|
| Conexão em `/gateway` (ou `/gateway?v=1`) | Envia `HELLO` com `heartbeat_interval` |
| `?v=` diferente de `1` / outro caminho | Upgrade recusado com HTTP 400 / 404 |
| `HEARTBEAT` | Responde `HEARTBEAT_ACK` e renova o prazo da sessão |
| Sem `HEARTBEAT` por 1,5 × o intervalo | Fecha com **4009** (`SESSION_TIMEOUT`); o cliente pode reconectar |
| JSON inválido, op desconhecido ou mensagem binária | Fecha com **4001** (`INVALID_MESSAGE`) |
| Mensagem acima de 4 KB | Fecha com **1009** |
| Evento publicado (`broadcast`) | `DISPATCH` com `t`, `d` e `s` (sequência por conexão, começando em 1) |
| Encerramento do processo (SIGTERM/SIGINT) | Envia `RECONNECT` a todos e fecha com **1001** |

Os códigos ficam em `GatewayCloseCode` (`@voxa/protocol/gateway`).

## `dev:ping` (só desenvolvimento)

Tudo o que é publicado no canal `dev:ping` do Valkey vira `DISPATCH DEV_PING` para todos os clientes. Prova o caminho Valkey → gateway → cliente, que os eventos reais vão usar. **Desligado com `NODE_ENV=production`.** O gateway usa duas conexões ao Valkey, porque uma em modo `SUBSCRIBE` não executa outros comandos (como o `PING` do `/health`).

## Configuração

| Variável | Padrão | Descrição |
|---|---|---|
| `GATEWAY_HOST` / `GATEWAY_PORT` | `127.0.0.1` / `4000` | Endereço de escuta |
| `GATEWAY_HEARTBEAT_INTERVAL_MS` | `41250` | Intervalo de heartbeat pedido ao cliente (mín. 1000) |
| `VALKEY_URL` | — | Obrigatória |
| `NODE_ENV`, `LOG_LEVEL` | `development`, `info` | Como na API |

## `GET /health`

`{ "status": "ok" | "error", "connections": <n>, "checks": { "valkey": { … } } }`, com HTTP 200 ou 503.

## Testes

```bash
pnpm --filter @voxa/gateway test:unit          # clientes WebSocket reais contra um gateway em porta aleatória
pnpm --filter @voxa/gateway test:integration   # dev:ping com o Valkey real (requer pnpm dev:infra)
```
