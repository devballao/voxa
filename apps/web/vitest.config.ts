import { configVitestVoxa } from "@voxa/config/vitest";

export default configVitestVoxa({
  test: {
    environment: "jsdom",
    setupFiles: ["./src/teste-setup.ts"],
    coverage: { exclude: ["src/main.tsx", "src/teste-setup.ts", "**/*.test.*"] },
  },
});
