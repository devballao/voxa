import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

type CompilerOptions = Record<string, unknown>;
type TsConfig = { extends?: string; compilerOptions?: CompilerOptions };

const raiz = new URL("../", import.meta.url);

function ler(arquivo: string): TsConfig {
  return JSON.parse(readFileSync(new URL(arquivo, raiz), "utf8")) as TsConfig;
}

/** Resolve a cadeia de `extends` (só caminhos relativos, como em packages/config). */
function opcoesEfetivas(arquivo: string): CompilerOptions {
  const config = ler(arquivo);
  const herdadas = config.extends ? opcoesEfetivas(config.extends.replace(/^\.\//, "")) : {};
  return { ...herdadas, ...config.compilerOptions };
}

const variantes = ["tsconfig.node.json", "tsconfig.library.json", "tsconfig.react.json"] as const;

describe("tsconfig compartilhado", () => {
  it.each(variantes)("%s herda as regras estritas da base", (variante) => {
    const opcoes = opcoesEfetivas(variante);

    expect(opcoes).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
    });
  });

  it.each(variantes)("%s declara `types` explicitamente (padrão do TS 7 é [])", (variante) => {
    expect(Array.isArray(opcoesEfetivas(variante).types)).toBe(true);
  });

  it("serviços e bibliotecas usam nodenext, para o Node carregar o build", () => {
    for (const variante of ["tsconfig.node.json", "tsconfig.library.json"]) {
      expect(opcoesEfetivas(variante)).toMatchObject({
        module: "nodenext",
        moduleResolution: "nodenext",
        rewriteRelativeImportExtensions: true,
      });
    }
  });

  it("serviços e bibliotecas só aceitam sintaxe removível (o Node 24 roda o .ts direto)", () => {
    for (const variante of ["tsconfig.node.json", "tsconfig.library.json"]) {
      expect(opcoesEfetivas(variante)).toMatchObject({ erasableSyntaxOnly: true });
    }
  });

  it("bibliotecas geram declarações de tipos", () => {
    expect(opcoesEfetivas("tsconfig.library.json")).toMatchObject({
      declaration: true,
      declarationMap: true,
    });
  });

  it("o app web usa resolução bundler, sem emitir arquivos", () => {
    expect(opcoesEfetivas("tsconfig.react.json")).toMatchObject({
      moduleResolution: "bundler",
      jsx: "react-jsx",
      noEmit: true,
    });
  });
});
