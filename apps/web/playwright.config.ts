import { defineConfig, devices } from "@playwright/test";

/**
 * Testes de ponta a ponta (E2E) do app web. Precisam do ambiente no ar
 * (`pnpm dev`); o `pnpm demo` sobe tudo, roda estes testes e gera as capturas.
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // Em sequência: as capturas da demonstração saem na ordem dos cenários.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.VOXA_E2E_URL ?? "http://localhost:5173",
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
