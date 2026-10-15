import { describe, expect, it, vi } from "vitest";
import {
  configVitestVoxa,
  integracaoDisponivel,
  MODO_INTEGRACAO,
  voxaVitest,
} from "../vitest.shared.js";

describe("configuração compartilhada do Vitest", () => {
  it("roda em Node e procura testes em src/ e test/", () => {
    expect(voxaVitest.test?.environment).toBe("node");
    expect(voxaVitest.test?.include).toEqual(
      expect.arrayContaining(["src/**/*.test.ts", "test/**/*.test.ts"]),
    );
  });

  it("falha quando um pacote com script de teste não tem testes", () => {
    expect(voxaVitest.test?.passWithNoTests).toBe(false);
  });

  it("gera cobertura com v8 em coverage/, ignorada pelo git", () => {
    expect(voxaVitest.test?.coverage).toMatchObject({
      provider: "v8",
      reportsDirectory: "coverage",
    });
  });
});

describe("modo de integração", () => {
  it("configVitestVoxa define VOXA_INTEGRACAO conforme o --mode", () => {
    const normal = configVitestVoxa()({ mode: "test", command: "serve" });
    const integracao = configVitestVoxa()({ mode: MODO_INTEGRACAO, command: "serve" });
    expect(normal.test?.env).toMatchObject({ VOXA_INTEGRACAO: "opcional" });
    expect(integracao.test?.env).toMatchObject({ VOXA_INTEGRACAO: "obrigatoria" });
  });

  it("configVitestVoxa mantém a base e aplica os ajustes do pacote", () => {
    const c = configVitestVoxa({ test: { fileParallelism: false } })({
      mode: "test",
      command: "serve",
    });
    expect(c.test).toMatchObject({ environment: "node", fileParallelism: false });
  });

  it("integracaoDisponivel: roda, pula ou falha", () => {
    vi.stubEnv("VOXA_INTEGRACAO", "opcional");
    expect(integracaoDisponivel(true, "x")).toBe(true);
    expect(integracaoDisponivel(false, "x")).toBe(false);

    vi.stubEnv("VOXA_INTEGRACAO", "obrigatoria");
    expect(() => integracaoDisponivel(false, "Rode pnpm dev:infra.")).toThrow(
      /sem infraestrutura configurada\. Rode pnpm dev:infra\./,
    );
  });
});
