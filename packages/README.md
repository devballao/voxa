# packages

Bibliotecas compartilhadas do monorepo.

| Pasta | Conteúdo | Issue |
|---|---|---|
| `config/` | tsconfig, lint e formatação compartilhados | #3 |
| `protocol/` | Esquemas Zod e tipos dos contratos cliente ↔ servidor ([README](protocol/README.md)) | #6 |
| `db/` | Drizzle: cliente, esquema e migrações ([README](db/README.md)) | #7 |
| `core/` | Domínio do backend: `VoxaError` e, a partir do MVP, os serviços ([README](core/README.md)) | #33 |
| `client-core/` | Stores e clientes REST/gateway, sem React | MVP |
| `media/` | Wrapper do livekit-client, áudio e captura de tela | MVP |
| `ui/` | Design system | MVP |

Regra: o código de cliente nunca importa `core` ou `db`. Ver [Desenvolvimento §10.1](../docs/10-desenvolvimento.md#101-estrutura-do-repositório-monorepo).
