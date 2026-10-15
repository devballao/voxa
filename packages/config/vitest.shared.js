/**
 * Configuração do Vitest compartilhada por todos os pacotes.
 *
 * Uso no `vitest.config.ts` de cada pacote:
 *
 *   import { voxaVitest } from "@voxa/config/vitest";
 *   import { defineConfig, mergeConfig } from "vitest/config";
 *
 *   export default mergeConfig(voxaVitest, defineConfig({ test: {} }));
 *
 * Escrito em JavaScript (com tipos em vitest.shared.d.ts) para não depender
 * de build nem de carregar TypeScript a partir de node_modules.
 */
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
