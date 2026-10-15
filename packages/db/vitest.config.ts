import { configVitestVoxa } from "@voxa/config/vitest";

export default configVitestVoxa({
  test: {
    // Os testes de integração compartilham o mesmo servidor Postgres: rodam em sequência.
    fileParallelism: false,
    coverage: { exclude: ["src/cli/**", "**/*.test.ts"] },
  },
});
