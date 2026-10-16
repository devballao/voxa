# @voxa/core

Domínio do backend do Voxa: as regras de negócio compartilhadas pela **API**, pelo **gateway** e pelo **worker** ([Backend §4.1](../../docs/04-backend.md#41-camadas-internas)). Não conhece HTTP nem WebSocket: recebe dados já validados e devolve resultados ou lança `VoxaError`.

Só o backend importa este pacote. O lint (Biome) impede `apps/*` de importá-lo ([Desenvolvimento §10.1](../../docs/10-desenvolvimento.md#dependências-entre-pacotes)).

## Erros de domínio: `VoxaError`

Todo erro que o cliente deve entender é um `VoxaError`, com um `code` da lista fechada de `@voxa/protocol` (`ErrorCode`):

```ts
import { VoxaError } from "@voxa/core";

throw new VoxaError("MISSING_PERMISSION", "Sem permissão para enviar mensagens.", {
  details: { permission: "SEND_MESSAGES" }, // vai para o cliente: nunca dados sensíveis
  cause: erroOriginal, // só para o log
});
```

| Código | Status HTTP |
|---|---|
| `VALIDATION_FAILED` | 400 |
| `UNAUTHORIZED` | 401 |
| `MISSING_PERMISSION` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |
| `SERVICE_UNAVAILABLE` | 503 |

A API converte o erro automaticamente (`err.status` e `err.paraResposta()`). Qualquer outro erro vira `500 INTERNAL_ERROR`, sem expor a mensagem interna. Um código novo entra primeiro em `ErrorCode` (`@voxa/protocol`); o TypeScript então exige o status correspondente em `STATUS_POR_CODIGO`.

## Organização

Cada área do domínio é uma pasta em `src/`, com nomes em português:

```
src/
├── erros/                 # VoxaError
├── <área>/                # ex.: contas/, servidores/, mensagens/
│   ├── servico.ts         # regras de negócio: a única porta de entrada da área
│   ├── repositorio.ts     # acesso ao banco (Drizzle), sem regras
│   ├── eventos.ts         # eventos de domínio publicados depois do commit
│   ├── servico.test.ts    # testes unitários, com o repositório substituído
│   └── index.ts           # o que a área exporta
└── index.ts
```

Regras ([Backend §4.1](../../docs/04-backend.md#41-camadas-internas)):

- **Rotas e handlers chamam serviços**, nunca repositórios nem o banco diretamente.
- **Serviços não conhecem HTTP**: recebem dados, devolvem dados ou lançam `VoxaError`.
- **Repositórios recebem as dependências** (conexão do banco) por parâmetro, para os serviços serem testados sem banco.
- Todo efeito colateral relevante gera um **evento de domínio**, publicado só depois do commit (padrão *transactional outbox*).

As primeiras áreas chegam no Milestone 2 (contas).

## Desenvolvimento

```bash
pnpm --filter @voxa/core build   # gera dist/ com tsc
pnpm --filter @voxa/core test
```
