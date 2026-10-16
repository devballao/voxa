# Voxa: guia para o Claude Code

Plataforma de comunicação em comunidade (chat, voz e tela), livre e auto-hospedável. A arquitetura está em [`docs/`](docs/README.md); as decisões, em [`docs/adr/`](docs/adr/README.md).

## Idioma

- Converse, escreva commits, issues, PRs, comentários e documentação em **português do Brasil**.
- Nomes no código seguem o que já existe: funções, variáveis e arquivos próprios em português (`ligarDevPing`, `PaginaStatus.tsx`, `verificacoes.mjs`); campos dos contratos em `@voxa/protocol` em inglês `snake_case` (`heartbeat_interval`).

## Fluxo de trabalho

1. O trabalho é organizado em **milestones** e **issues** no GitHub. Cada issue tem contexto, tarefas, critérios de aceite e dependências.
2. **Um PR por issue**, com `Closes #N`. O PR descreve o problema, a solução, a verificação feita e, numa seção própria, **o que não foi verificado**.
3. A pessoa mantenedora revisa, testa e aprova. **Nunca faça push na `main` nem merge de PR.**
4. **Uma issue por vez.** Depois de abrir um PR, pare e espere a pessoa mantenedora dizer que ele foi aprovado. Só então comece a próxima issue: o merge, sozinho, não é sinal para seguir.
5. **Antes de cada PR**, revise e registre no PR, numa seção própria:
   - **`.gitignore`:** rode o que a mudança afeta (build, testes, `pnpm dev`, `pnpm demo`) e confira com `git status --ignored` que nenhum arquivo gerado (build, cache, relatórios, capturas, `.env`, dados locais) ficaria fora do `.gitignore`.
   - **Informação sensível:** procure no diff tokens, senhas, chaves, certificados, e-mails pessoais e dados de produção. Confirme que logs, mensagens de erro e páginas geradas não expõem nada disso. Valores de desenvolvimento ficam só no `.env.example`, marcados como tal.
6. Commits em [Conventional Commits](https://www.conventionalcommits.org/pt-br/) (`feat(api): …`, `fix(devcontainer): …`, `docs: …`).
7. Mudou um fluxo? Atualize o diagrama em `docs/`. Decisão de arquitetura nova ou alterada vira um ADR.

## Comandos

| Comando | Para quê |
|---|---|
| `pnpm bootstrap` | Primeira vez: `.env`, infraestrutura (Docker) e migrações |
| `pnpm dev` | API `:3000`, gateway `:4000`, worker e app web `:5173` |
| `pnpm lint` / `pnpm lint:fix` | Biome (lint e formatação) |
| `pnpm typecheck` | `tsc --noEmit` em todos os pacotes |
| `pnpm test:unit` | Testes unitários (sem Docker) |
| `pnpm test:integration` | Testes de integração (precisa de `pnpm dev:infra` e `.env`) |
| `pnpm db:generate` / `pnpm db:migrate` | Gerar e aplicar migrações do Drizzle |

Antes de abrir um PR: `pnpm lint && pnpm typecheck && pnpm test:unit`; se mexeu em banco, API ou outro código com testes de integração, também `pnpm test:integration`.

## Regras do código

- **TypeScript 7** estrito (compilador em Go, sem a API JavaScript clássica: nada de `typescript-eslint`, `tsup` ou `vite-plugin-dts`). Em `services/*` e `packages/*`, importe `./arquivo.ts`.
- **Fronteiras** (verificadas pelo Biome): o código de cliente nunca importa `@voxa/core` ou `@voxa/db`; o backend nunca importa `@voxa/ui` ou `@voxa/media`.
- Testes unitários ao lado do código (`src/**/*.test.ts`); integração em `test/integration/` de cada pacote.
- Dependências com **versão exata**, assim como imagens Docker, features do Dev Container e Actions (estas pelo hash do commit).
- Detalhes em [Desenvolvimento](docs/10-desenvolvimento.md) e [CONTRIBUTING.md](CONTRIBUTING.md).
