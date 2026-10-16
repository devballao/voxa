# @voxa/worker

Processa tarefas assíncronas do Voxa a partir de **streams do Valkey** ([Backend §4.8](../../docs/04-backend.md#48-workers-e-filas)).

> Estágio atual (Milestone 0): consome o stream de teste `dev:jobs`. As filas reais (`outbox`, `media.process`, `notify.*`…) chegam no MVP.

## Rodando

Com `pnpm dev:infra` e o `.env` da raiz:

```bash
pnpm --filter @voxa/worker dev
# em outro terminal:
docker compose -f infra/compose/docker-compose.dev.yml exec valkey valkey-cli XADD dev:jobs '*' tipo teste
# o log do worker mostra: tarefa processada (dev:jobs) { id, campos: { tipo: "teste" } }
```

## Como funciona

Cada fila é um stream lido com **consumer group** (`XREADGROUP` + `XACK`):

- **Cada tarefa vai para um único worker**, mesmo com várias instâncias rodando (grupo `voxa-workers`).
- A tarefa só é **confirmada (`XACK`) depois de processada com sucesso**. Se o processamento falhar, ela fica **pendente** no grupo (`XPENDING`), para nova tentativa. A recuperação automática de pendentes (`XAUTOCLAIM`) fica para o MVP.
- O grupo e o stream são criados na inicialização, se não existirem.
- Cada leitura espera até 2 s por tarefas novas (`BLOCK`). No encerramento (SIGTERM/SIGINT), o worker termina a leitura em andamento e o processamento atual, e então sai.

Para adicionar uma fila: chame `iniciarConsumidor({ stream, grupo, processar, … })` em `src/main.ts`.

## Configuração

| Variável | Padrão | Descrição |
|---|---|---|
| `VALKEY_URL` | — | Obrigatória |
| `WORKER_NAME` | `<hostname>-<pid>` | Nome deste consumidor no grupo |
| `NODE_ENV`, `LOG_LEVEL` | `development`, `info` | Como na API |

## Testes

```bash
pnpm --filter @voxa/worker test:unit          # Valkey simulado: confirmação, falha de processamento, falha de leitura
pnpm --filter @voxa/worker test:integration   # Valkey real, stream descartável (requer pnpm dev:infra)
```
