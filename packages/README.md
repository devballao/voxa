# packages

Bibliotecas compartilhadas do monorepo.

| Pasta | Conteúdo | Issue |
|---|---|---|
| `config/` | tsconfig, lint e formatação compartilhados | #3 |
| `protocol/` | Esquemas Zod e tipos dos contratos cliente ↔ servidor | #6 |
| `db/` | Drizzle: esquema e migrações | #7 |
| `core/` | Domínio do backend | MVP |
| `client-core/` | Stores e clientes REST/gateway, sem React | MVP |
| `media/` | Wrapper do livekit-client, áudio e captura de tela | MVP |
| `ui/` | Design system | MVP |

Regra: o código de cliente nunca importa `core` ou `db`. Ver [Desenvolvimento §10.1](../docs/10-desenvolvimento.md#101-estrutura-do-repositório-monorepo).
