import { voxaVitest } from "@voxa/config/vitest";
import { defineConfig, mergeConfig } from "vitest/config";

export default mergeConfig(
  voxaVitest,
  defineConfig({
    test: {
      coverage: { exclude: ["src/main.ts", "**/*.test.ts"] },
    },
  }),
);
