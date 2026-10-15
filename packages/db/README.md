# @voxa/db

Acesso ao PostgreSQL do Voxa: cliente com pool, esquema ([Drizzle ORM](https://orm.drizzle.team)) e migrações versionadas.

## Comandos

Na raiz do repositório, com a infraestrutura rodando (`pnpm dev:infra`) e o `.env` criado (`cp .env.example .env`):

| Comando | O que faz |
|---|---|
| `pnpm db:migrate` | Aplica as migrações pendentes. Idempotente: rodar de novo não faz nada |
| `pnpm db:generate --name <descricao>` | Gera uma migração SQL a partir das mudanças em `src/schema/` |
| `pnpm db:studio` | Abre o Drizzle Studio (interface em `https://local.drizzle.studio`, servidor local na porta 4983) |

## Uso nos serviços

```ts
import { aplicarMigracoes, createDb, schema } from "@voxa/db";

const { db, close } = createDb(); // lê DATABASE_URL; pool de 10 conexões
const meta = await db.select().from(schema.voxaMeta);

process.on("SIGTERM", async () => {
  await close(); // espera até 5 s pelas consultas em andamento
  process.exit(0);
});
```

`createDb()` aceita `url`, `max`, `idleTimeout` e `connectTimeout`. Em desenvolvimento, `DATABASE_URL` vem do `.env` da raiz, carregado automaticamente; variáveis já definidas no ambiente têm prioridade.

## Estrutura

```
packages/db/
├── src/
│   ├── schema/          # tabelas (Drizzle) — fonte das migrações geradas
│   ├── client.ts        # createDb(): pool + drizzle
│   ├── migrate.ts       # aplicarMigracoes(): usado pelo db:migrate e, no futuro, pelo voxa-admin
│   └── cli/migrate.ts   # comando pnpm db:migrate (roda direto no Node 24, sem build)
├── migrations/          # SQL versionado + meta/ (gerado pelo drizzle-kit, não editar)
└── drizzle.config.ts
```

O `pnpm db:migrate` usa o migrador do `drizzle-orm`, e não o `drizzle-kit migrate`: em produção, a migração precisa rodar sem ferramentas de desenvolvimento. As migrações aplicadas ficam registradas em `drizzle.__drizzle_migrations`.

## Criando uma migração

1. Altere ou crie tabelas em `src/schema/` (e exporte em `src/schema/index.ts`).
2. `pnpm db:generate --name descricao-curta`.
3. **Revise o SQL gerado** em `migrations/`. Dados iniciais podem ser acrescentados à mão, depois de um `--> statement-breakpoint`, como em `0000_inicial.sql`.
4. `pnpm db:migrate` e `pnpm --filter @voxa/db test`.
5. Faça o commit do `.sql` **e** dos arquivos em `migrations/meta/`.

Nunca edite uma migração que já está na `main`: crie uma nova.

## Regra: expandir → migrar → contrair

Durante uma atualização, a versão nova e a antiga da API rodam **ao mesmo tempo** por alguns instantes (ver [Infraestrutura §3.6](../../docs/03-infraestrutura.md#36-instalação-nó-único)). Por isso, **toda migração precisa funcionar com o código da versão anterior**. Mudanças que quebram são feitas em três versões:

| Etapa | Exemplo: renomear `username` para `handle` |
|---|---|
| **1. Expandir** (versão N) | Adicionar a coluna `handle` (opcional). O código grava nas **duas** colunas e lê de `username` |
| **2. Migrar** (versão N, job ou migração de dados) | Copiar `username` → `handle` nas linhas antigas. O código passa a ler de `handle` |
| **3. Contrair** (versão N+1, depois que ninguém mais roda a N−1) | Remover `username` |

Na prática:

- ✅ Adicionar tabela, coluna opcional ou com `DEFAULT`, ou índice (`CREATE INDEX CONCURRENTLY` em tabelas grandes).
- ⚠️ Tornar uma coluna `NOT NULL`: primeiro preencher todas as linhas, depois aplicar a restrição numa versão seguinte.
- ❌ Renomear ou remover coluna ou tabela, ou mudar o tipo, numa única migração.

## Testes

```bash
pnpm --filter @voxa/db test:unit          # unitários (src/), sem Docker
pnpm --filter @voxa/db test:integration   # integração (test/integration/), requer pnpm dev:infra
pnpm --filter @voxa/db test               # todos
```

- Os **testes de integração** (`test/integration/`) criam um banco descartável (`voxa_teste_<aleatório>`), aplicam as migrações do zero, conferem a idempotência e apagam o banco no fim.
- Sem `DATABASE_URL` (nem `.env`), eles são **pulados** em `test` e **falham** com instruções em `test:integration`.
