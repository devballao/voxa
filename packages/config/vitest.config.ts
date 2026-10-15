import { defineConfig, mergeConfig } from "vitest/config";
import { voxaVitest } from "./vitest.shared.js";

export default mergeConfig(
  voxaVitest,
  defineConfig({
    test: {
      // Este pacote não tem src/: os testes validam os arquivos de configuração.
      coverage: { include: ["vitest.shared.js"] },
    },
  }),
);
