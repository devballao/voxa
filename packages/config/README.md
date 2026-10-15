# @voxa/config

Configuração compartilhada do TypeScript (7.x). Estenda a variante adequada no `tsconfig.json` do pacote:

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
