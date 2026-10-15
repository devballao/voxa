# 10. Desenvolvimento

## 10.1 Estrutura do repositório (monorepo)

```
voxa/
├── apps/
│   ├── web/                 # app React (Vite)
│   └── desktop/             # Tauri 2 (src-tauri em Rust + reaproveita apps/web)
├── services/
│   ├── api/                 # Fastify — REST
│   ├── gateway/             # WebSocket
│   └── worker/              # filas
├── packages/
│   ├── protocol/            # esquemas Zod, tipos, OpenAPI, eventos do gateway
│   ├── core/                # domínio do backend: serviços, permissões, snowflake
│   ├── db/                  # Drizzle: esquema e migrações
│   ├── client-core/         # stores, cliente REST/gateway, fila offline (sem React)
│   ├── media/               # wrapper do livekit-client, áudio, captura de tela
│   ├── ui/                  # design system
│   └── config/              # tsconfig, eslint, prettier compartilhados
├── infra/
│   ├── compose/             # docker-compose.yml, Caddyfile, livekit.yaml, .env.example
│   ├── helm/                # chart para Kubernetes
│   └── grafana/             # dashboards versionados
├── docs/                    # esta documentação
└── .github/workflows/       # CI/CD
```

Ferramentas: **pnpm** (workspaces), **Turborepo** (cache de build e testes), **TypeScript 7** estrito e **Biome** (lint e formatação).

### Configuração compartilhada (`packages/config`)

Cada pacote estende uma das variantes:

| Variante | Para | Resolução de módulos |
|---|---|---|
| `tsconfig.node.json` | `services/*` | `nodenext`, com `rewriteRelativeImportExtensions` (importe `./arquivo.ts`; o build emite `./arquivo.js`) |
| `tsconfig.library.json` | `packages/*` consumidos pelo Node e pelo web | Igual à Node, gerando também `.d.ts` |
| `tsconfig.react.json` | `apps/web` | `bundler` (o Vite resolve), com DOM e JSX |

Todas herdam de `tsconfig.base.json`: `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax` e `isolatedModules`.

- **TypeScript 7** (o compilador reescrito em Go) **não tem a API JavaScript clássica**. Ferramentas que dependem dela (`typescript-eslint`, `tsup`/`rollup-plugin-dts` para `.d.ts`, `vite-plugin-dts`) não funcionam. Use o próprio `tsc` para gerar tipos; Vite, Vitest e `tsx` só removem os tipos e funcionam normalmente.
- No TS 7, `types` é `[]` por padrão: declare explicitamente o que cada variante usa (`node`, `vite/client`).
- O **Biome** roda uma vez na raiz (`pnpm lint`, `pnpm lint:fix`, `pnpm format`). O `pnpm typecheck` roda o `tsc --noEmit` de cada pacote via Turborepo.
- As **fronteiras da regra abaixo** são verificadas pelo Biome (`noRestrictedImports` em `biome.json`): `apps/*`, `client-core`, `media` e `ui` não importam `@voxa/core`/`@voxa/db`, e o backend não importa `@voxa/ui`/`@voxa/media`.

### Dependências entre pacotes

```mermaid
flowchart BT
    protocol["@voxa/protocol"]
    core["@voxa/core"] --> protocol
    db["@voxa/db"] --> core
    api["services/api"] --> core & db
    gateway["services/gateway"] --> core & db
    worker["services/worker"] --> core & db
    clientcore["@voxa/client-core"] --> protocol
    media["@voxa/media"] --> protocol
    ui["@voxa/ui"]
    web["apps/web"] --> clientcore & media & ui
    desktop["apps/desktop"] --> web
```

Regra: o código de cliente **nunca** importa `core` ou `db`; o backend nunca importa `ui` ou `media`. O lint (Biome) garante isso.

## 10.2 Ambiente local

Pré-requisitos: Node.js 24 LTS (ver `.nvmrc`), pnpm 12 (via `corepack enable`), Docker; Rust stable só para o desktop.

```bash
git clone https://github.com/devballao/voxa.git && cd voxa
pnpm install
cp .env.example .env  # valores apenas de desenvolvimento
pnpm dev:infra        # sobe postgres, valkey, s3 (garage), livekit e mailpit via compose
pnpm db:migrate
pnpm db:seed          # servidor de exemplo + 3 contas de teste
pnpm dev              # api :3000, gateway :4000, web :5173 com hot reload
```

- Portas, credenciais de dev e solução de problemas da infraestrutura: [`infra/compose/README.md`](../infra/compose/README.md). Para parar: `pnpm dev:infra:down`; para apagar os dados: `pnpm dev:infra:reset`.
- E-mails de desenvolvimento aparecem no **Mailpit** (`http://localhost:8025`).
- Para testar voz com duas pessoas: abra uma janela anônima e entre com outra conta de teste.
- Também há um `devcontainer.json` para Codespaces e VS Code.

## 10.3 Testes

| Tipo | Ferramenta | O que cobre |
|---|---|---|
| Unitário | Vitest | Permissões, snowflake, validação, reducers das stores |
| Propriedades | fast-check | Cálculo de permissões (ex.: "deny sempre vence allow no mesmo nível") |
| Integração | Vitest + Testcontainers | API contra Postgres/Valkey reais; gateway com clientes WebSocket simulados |
| Contrato | Esquemas de `@voxa/protocol` | Respostas da API batem com o OpenAPI |
| E2E | Playwright | Cadastro → criar servidor → mensagem → entrar em voz (Chromium e Firefox, com mídia simulada `--use-fake-device-for-media-stream`) |
| Carga | k6 (HTTP/WS) + `lk load-test` (mídia) | Mensagens por segundo, conexões no gateway, participantes por nó |
| Acessibilidade | axe (Storybook + Playwright) | Componentes e telas principais |

Meta de cobertura: 80 % em `packages/core` e `packages/protocol`. Nas demais partes, testes guiados por risco.

### Como rodar e adicionar testes

**Onde ficam os testes:**

| Tipo | Local | Precisa de |
|---|---|---|
| **Unitário** | Ao lado do código: `src/**/*.test.ts` (ex.: `app.ts` + `app.test.ts`) | Nada (sem Docker, sem `.env`) |
| **Integração** | Pasta própria em cada pacote: `test/integration/**/*.test.ts` | `pnpm dev:infra` + `.env` |

Unitários ficam junto do código, como é o padrão no ecossistema TypeScript/Vitest: fica evidente quando um arquivo não tem teste, e o teste se move junto com o módulo. Os de integração ficam separados porque são mais lentos e dependem de serviços externos. Tudo fica no mesmo repositório, para código e teste mudarem no mesmo PR.

| Comando (na raiz) | O que faz |
|---|---|
| `pnpm test:unit` | Só os unitários. Rápido, funciona sem Docker; use no dia a dia |
| `pnpm test:integration` | Só os de integração. **Falha** se a infraestrutura não estiver configurada, para o CI não passar sem testar nada. Sem cache |
| `pnpm test` | Todos. Os de integração são **pulados** se não houver `.env` |
| `pnpm test:watch` | Modo watch em todos os pacotes |
| `pnpm test:coverage` | Todos, com cobertura (v8) de `src/`; relatório HTML e lcov em `<pacote>/coverage/` |
| `pnpm --filter @voxa/<pacote> test:unit` | Só um pacote |

Cada pacote tem seu próprio Vitest, estendendo a configuração compartilhada (`@voxa/config/vitest`). Não usamos o recurso de *projects*/*workspace* do Vitest: ele impediria o cache por pacote do Turborepo. Para adicionar testes a um pacote:

1. `devDependencies`: `vitest`, `@vitest/coverage-v8` e `vite` (mesmas versões de `packages/config`).
2. Scripts:
   ```json
   "test": "vitest run",
   "test:unit": "vitest run src/",
   "test:integration": "vitest run --mode integration test/integration/",
   "test:watch": "vitest",
   "test:coverage": "vitest run --coverage"
   ```
   Pacotes sem testes de integração usam `"test:unit": "vitest run"` e não têm `test:integration`.
3. `vitest.config.ts`:
   ```ts
   import { configVitestVoxa } from "@voxa/config/vitest";

   export default configVitestVoxa(); // ou configVitestVoxa({ test: { /* ajustes */ } })
   ```
4. Nos testes de integração, decida entre rodar, pular ou falhar com `integracaoDisponivel`:
   ```ts
   import { integracaoDisponivel } from "@voxa/config/vitest";

   const rodar = integracaoDisponivel(urlDoBanco !== undefined, "Rode `pnpm dev:infra` e `cp .env.example .env`.");
   describe.skipIf(!rodar)("integração com …", () => { /* … */ });
   ```
   Em `pnpm test`, sem infraestrutura, o bloco é pulado; em `pnpm test:integration` (modo `integration`), vira erro com a instrução.

## 10.4 Convenções

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat(gateway): resume em outro nó`), que alimentam o changelog automático.
- **Branches:** `main` sempre implantável; trabalho em `feat/…`, `fix/…`; PRs pequenos.
- **Revisão:** 1 aprovação; 2 para `packages/core/permissions`, autenticação e criptografia.
- **ADRs:** decisões de arquitetura novas ou alteradas viram um arquivo em `docs/adr/`.
- **Código:** sem `any` implícito; erros de domínio tipados (`VoxaError` com `code`); logs estruturados, nunca com conteúdo de mensagens.
- **Migrações:** sempre compatíveis com a versão anterior (expandir → migrar → contrair).

## 10.5 CI/CD

### O que roda hoje

O workflow [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) roda em todo pull request e em todo push na `main`, com dois jobs em paralelo:

```mermaid
flowchart LR
    PR["Pull request<br/>ou push na main"] --> V
    PR --> I
    subgraph V["Verificação"]
        direction TB
        v1["pnpm install"] --> v2["lint"] --> v3["typecheck"] --> v4["test:unit"] --> v5["build"]
    end
    subgraph I["Integração"]
        direction TB
        i1["pnpm install"] --> i2["pnpm dev:infra<br/>Postgres, Valkey, Garage,<br/>LiveKit, Mailpit"] --> i3["test:integration"]
    end
```

- **Verificação:** com cache do pnpm e do Turborepo; não precisa de Docker.
- **Integração:** usa a **mesma infraestrutura do desenvolvimento local** (`pnpm dev:infra`). Assim o CI também testa o Compose e o script de inicialização. Se falhar, os logs dos contêineres aparecem no fim do job.
- **Segurança:**
  - permissão mínima (`contents: read`);
  - Actions fixadas pelo **hash do commit**, com a versão no comentário;
  - `persist-credentials: false` no checkout.
- **Concorrência:** um push novo no mesmo PR cancela a execução anterior.
- **Atualizar uma Action:** troque o hash e o comentário juntos, usando uma versão publicada há pelo menos 14 dias. Valide com `docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.12`.

### Visão completa (fases seguintes)

```mermaid
flowchart LR
    PR["Pull request"] --> L["lint + typecheck"]
    L --> U["testes unitários<br/>e de integração"]
    U --> E["E2E Playwright"]
    E --> B["build das imagens<br/>+ SBOM"]
    B --> OK{"aprovado?"}
    OK -->|merge na main| M["imagens :edge<br/>implanta no staging"]
    M --> T["tag vX.Y.Z"]
    T --> R["release: imagens assinadas com cosign,<br/>binários desktop assinados, changelog"]
    R --> P["instância pública<br/>atualiza com aprovação manual"]
```

- Imagens publicadas no GitHub Container Registry (`ghcr.io/devballao/voxa-api` …).
- Binários do desktop: AppImage, `.deb`, Flatpak (Flathub); Windows `.msi`; macOS `.dmg`, com auto-update do Tauri apontando para releases assinados.
- Versionamento semântico; o protocolo do gateway tem versão própria (`?v=1`), e o servidor aceita a versão atual e a anterior.

## 10.6 Documentar enquanto desenvolve

- Cada PR que muda um fluxo atualiza o diagrama correspondente em `docs/`.
- A especificação OpenAPI é gerada no build e publicada em `/api/docs` (Scalar ou Redoc).
- Os eventos do gateway são documentados a partir dos esquemas de `@voxa/protocol` (geração automática).
