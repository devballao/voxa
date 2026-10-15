import { voxaVitest } from "@voxa/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  voxaVitest,
  defineConfig({
    test: {
      // Os testes de integração compartilham o mesmo banco: rodam em sequência.
      fileParallelism: false,
      coverage: { exclude: ["src/cli/**", "**/*.test.ts"] },
    },
  }),
);
