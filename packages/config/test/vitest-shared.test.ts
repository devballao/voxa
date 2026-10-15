import { describe, expect, it } from "vitest";
import { voxaVitest } from "../vitest.shared.js";

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
