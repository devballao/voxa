import { configVitestVoxa } from "@voxa/config/vitest";

export default configVitestVoxa({
  test: {
    coverage: { exclude: ["src/main.ts", "**/*.test.ts"] },
  },
});
