import { describe, expect, it } from "vitest";
import { carregarConfig, ErroDeConfiguracao } from "./config.ts";

describe("carregarConfig (worker)", () => {
  it("aceita a configuração mínima", () => {
    expect(carregarConfig({ VALKEY_URL: "redis://localhost:6379" })).toMatchObject({
      NODE_ENV: "development",
      LOG_LEVEL: "info",
    });
  });

  it("recusa VALKEY_URL ausente ou inválida", () => {
    expect(() => carregarConfig({})).toThrow(ErroDeConfiguracao);
    expect(() => carregarConfig({ VALKEY_URL: "http://h" })).toThrow(/VALKEY_URL/);
  });
});
