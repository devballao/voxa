/**
 * Configuração do Vitest compartilhada por todos os pacotes.
 *
 * Uso no `vitest.config.ts` de cada pacote:
 *
 *   import { configVitestVoxa } from "@voxa/config/vitest";
 *   export default configVitestVoxa({ test: {} }); // ajustes do pacote (opcional)
 *
 * Convenção de testes (docs/10-desenvolvimento.md §10.3):
 *   - unitários ao lado do código: src/**\/*.test.ts       → pnpm test:unit
 *   - integração em pasta própria:  test/integration/**    → pnpm test:integration
 *
 * Escrito em JavaScript (com tipos em vitest.shared.d.ts) para não depender
 * de build nem de carregar TypeScript a partir de node_modules.
 */
import { defineConfig, mergeConfig } from "vitest/config";

export const voxaVitest = {
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "test/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**"],
      exclude: ["**/*.test.*", "**/*.d.ts"],
    },
  },
};

/** Modo do Vitest usado por `pnpm test:integration` (`vitest run --mode integration`). */
export const MODO_INTEGRACAO = "integration";

/**
 * Monta o `vitest.config.ts` de um pacote: configuração compartilhada + ajustes.
 * No modo de integração, define VOXA_INTEGRACAO=obrigatoria (lida por `integracaoDisponivel`).
 */
export function configVitestVoxa(ajustes = {}) {
  return defineConfig(({ mode }) =>
    mergeConfig(
      mergeConfig(voxaVitest, {
        test: {
          env: { VOXA_INTEGRACAO: mode === MODO_INTEGRACAO ? "obrigatoria" : "opcional" },
        },
      }),
      ajustes,
    ),
  );
}

/**
 * Decide se os testes de integração rodam:
 * - infraestrutura disponível → true (rodam);
 * - indisponível em `pnpm test` → false (são pulados);
 * - indisponível em `pnpm test:integration` → erro, para o CI não passar sem testar nada.
 *
 * @param {boolean} disponivel se a infraestrutura necessária está configurada
 * @param {string} comoResolver instrução mostrada no erro
 */
export function integracaoDisponivel(disponivel, comoResolver) {
  if (disponivel) return true;
  if (process.env.VOXA_INTEGRACAO === "obrigatoria") {
    throw new Error(`Testes de integração sem infraestrutura configurada. ${comoResolver}`);
  }
  return false;
}
