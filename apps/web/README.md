# @voxa/web

App web do Voxa (React 19 + Vite 8). Por enquanto (Milestone 0), tem uma única página, **"Status do ambiente"**, que valida o ambiente de ponta a ponta: API, gateway e dependências.

## Rodando

Na raiz do repositório:

```bash
pnpm bootstrap   # primeira vez
pnpm dev         # sobe API, gateway, worker e este app → http://localhost:5173
```

Para rodar só o app web (com a API e o gateway já no ar): `pnpm --filter @voxa/web dev`.

Em desenvolvimento, **o navegador fala só com o Vite**, que repassa `/api` → `127.0.0.1:3000` e `/gateway` → `127.0.0.1:4000` (WebSocket). Por isso as URLs do app são relativas e não há CORS. Para apontar o proxy para outro lugar: `VITE_DEV_API_TARGET` e `VITE_DEV_GATEWAY_TARGET`. Em builds servidos fora do Vite, `VITE_API_URL` e `VITE_GATEWAY_URL` (em `apps/web/.env.local`) definem as URLs absolutas.

## A página de status

| Seção | Mostra |
|---|---|
| Resumo | **Tudo funcionando** / **Há serviços com problema** (anunciado por leitores de tela, `role="status"`) |
| API | Resultado do `GET /api/v1/health`, consultado a cada 5 s: status e latência de Postgres, Valkey, S3 e LiveKit. Se a API cair: "API inacessível" e o motivo |
| Gateway | Conexão, `HELLO`, heartbeats confirmados, último evento (`DEV_PING`) e último fechamento (ex.: `1001 servidor reiniciando`) |

Para ver um evento chegar: `docker compose -f infra/compose/docker-compose.dev.yml exec valkey valkey-cli PUBLISH dev:ping oi`.

## Estrutura

```
src/
├── app/                 # raiz da aplicação e estilos globais
├── features/status/     # página de status: PaginaStatus (visual) + hooks (dados)
├── lib/                 # sem React: cliente REST (api.ts) e cliente do gateway (gateway.ts)
└── main.tsx
```

O que está em `lib/` não depende de React, para ser movido para `@voxa/client-core` no MVP. O **cliente do gateway** segue `docs/04-backend.md` §4.6:
- envia `HEARTBEAT` logo após o `HELLO` e depois a cada intervalo;
- se um heartbeat fica sem ACK até o próximo envio, considera a conexão morta e reconecta;
- reconecta com espera crescente (1 s, 2 s, 4 s… até 30 s, ±20%);
- respeita o `RECONNECT` do servidor;
- não reconecta em laço após o código `4001` (erro do próprio cliente).

## Acessibilidade e idioma

- O estado é sempre indicado **por texto** (`✓ ok`, `✕ ECONNREFUSED`); a cor só reforça.
- Tabela e lista com cabeçalhos semânticos (`th scope`, `dl`); tema claro/escuro conforme o sistema.
- Números no formato pt-BR (`41,25 s`, `5,6 ms`). A internacionalização completa (i18next) fica para o MVP.

## Testes

```bash
pnpm --filter @voxa/web test:unit
```

Vitest com **jsdom** e Testing Library:
- cliente do gateway com WebSocket simulado e relógio controlado (heartbeat, ACK perdido, backoff, `RECONNECT`, 4001);
- leitura do `/health` (200, 503, 502 do proxy, falha de rede);
- a página em cada cenário e os hooks.

Testes no navegador (Playwright) entram no MVP.
