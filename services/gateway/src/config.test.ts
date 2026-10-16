import { describe, expect, it } from "vitest";
import { carregarConfig, ErroDeConfiguracao } from "./config.ts";

describe("carregarConfig (gateway)", () => {
  it("aplica padrões", () => {
    expect(carregarConfig({ VALKEY_URL: "redis://localhost:6379" })).toMatchObject({
      GATEWAY_HOST: "127.0.0.1",
      GATEWAY_PORT: 4000,
      GATEWAY_HEARTBEAT_INTERVAL_MS: 41_250,
    });
  });

  it("recusa configuração inválida, sem expor valores", () => {
    expect(() =>
      carregarConfig({ VALKEY_URL: "http://usuario:senha@h", GATEWAY_HEARTBEAT_INTERVAL_MS: "10" }),
    ).toThrow(ErroDeConfiguracao);
    try {
      carregarConfig({ VALKEY_URL: "http://usuario:senha@h" });
    } catch (e) {
      expect((e as Error).message).not.toContain("senha");
    }
  });
});
