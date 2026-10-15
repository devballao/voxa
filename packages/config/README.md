# @voxa/config

Configuração compartilhada do TypeScript (7.x) e do Vitest. Estenda a variante adequada no `tsconfig.json` do pacote:

```jsonc
// services/api/tsconfig.json
{ "extends": "@voxa/config/tsconfig.node.json", "include": ["src"] }

// packages/protocol/tsconfig.json
{
  "extends": "@voxa/config/tsconfig.library.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "include": ["src"]
}

// apps/web/tsconfig.json
{ "extends": "@voxa/config/tsconfig.react.json", "include": ["src"] }
```

E adicione `"@voxa/config": "workspace:*"` e `"typescript"` nas `devDependencies`. Serviços também precisam de `@types/node`, e o app web, de `vite`.

Detalhes e o motivo de cada variante: [docs/10-desenvolvimento.md](../../docs/10-desenvolvimento.md#configuração-compartilhada-packagesconfig).

## Vitest

`@voxa/config/vitest` exporta a configuração de testes comum a todos os pacotes (ambiente Node, padrões de arquivos de teste e cobertura v8 de `src/` em `coverage/`):

```ts
// <pacote>/vitest.config.ts
import { configVitestVoxa } from "@voxa/config/vitest";

export default configVitestVoxa(); // ajustes do pacote: configVitestVoxa({ test: { … } })
```

| Exportação | Uso |
|---|---|
| `configVitestVoxa(ajustes?)` | Monta o `vitest.config.ts`. Com `--mode integration`, marca os testes de integração como obrigatórios |
| `integracaoDisponivel(disponivel, comoResolver)` | Nos testes de integração: `true` para rodar, `false` para pular (`pnpm test`), ou erro com a instrução (`pnpm test:integration`) |
| `voxaVitest` | A configuração base, como objeto |

O arquivo é JavaScript puro com tipos em `vitest.shared.d.ts`, para funcionar sem build. Convenção de onde ficam os testes e passo a passo para adicioná-los: [docs/10-desenvolvimento.md](../../docs/10-desenvolvimento.md#como-rodar-e-adicionar-testes).

Os testes deste pacote (`test/`) garantem que as variantes de `tsconfig` mantêm as regras críticas (`strict`, `nodenext` e `erasableSyntaxOnly` nos serviços, `bundler` no web) e que a configuração do Vitest não muda sem querer.
