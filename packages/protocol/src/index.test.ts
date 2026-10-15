import { describe, expect, it } from "vitest";
import * as gateway from "./gateway/index.ts";
import * as http from "./http/index.ts";
import * as raiz from "./index.ts";

describe("API pública de @voxa/protocol", () => {
  it("expõe as versões e caminhos da API e do gateway", () => {
    expect(raiz.API_VERSION).toBe(999); // ERRO PROPOSITAL
    expect(raiz.API_BASE_PATH).toBe("/api/v1");
    expect(raiz.GATEWAY_VERSION).toBe(1);
    expect(raiz.GATEWAY_PATH).toBe("/gateway");
  });

  it("@voxa/protocol/http exporta os esquemas HTTP", () => {
    expect(Object.keys(http).sort()).toEqual([
      "ErrorCode",
      "ErrorResponse",
      "HealthCheck",
      "HealthDependency",
      "HealthResponse",
      "HealthStatus",
    ]);
  });

  it("@voxa/protocol/gateway exporta os esquemas do gateway", () => {
    expect(Object.keys(gateway).sort()).toEqual([
      "ClientMessage",
      "GatewayEnvelope",
      "GatewayOp",
      "HeartbeatAckMessage",
      "HeartbeatMessage",
      "HelloMessage",
      "ServerMessage",
    ]);
  });

  it("a raiz reexporta tudo de http e gateway", () => {
    for (const nome of [...Object.keys(http), ...Object.keys(gateway)]) {
      expect(raiz).toHaveProperty(nome);
    }
  });
});
