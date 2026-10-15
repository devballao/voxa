import { describe, expect, it } from "vitest";
import { HealthResponse } from "./health.ts";

const saudavel = {
  status: "ok",
  version: "0.0.0",
  uptime_s: 12.5,
  checks: {
    postgres: { status: "ok", latency_ms: 3 },
    valkey: { status: "ok", latency_ms: 1 },
    s3: { status: "ok", latency_ms: 8 },
    livekit: { status: "ok", latency_ms: 5 },
  },
};

describe("HealthResponse", () => {
  it("aceita uma resposta saudável", () => {
    expect(HealthResponse.parse(saudavel)).toEqual(saudavel);
  });

  it("aceita uma dependência com erro e o motivo", () => {
    const comFalha = {
      ...saudavel,
      status: "error",
      checks: {
        ...saudavel.checks,
        postgres: { status: "error", latency_ms: 2000, error: "timeout" },
      },
    };
    expect(HealthResponse.parse(comFalha).checks.postgres?.error).toBe("timeout");
  });

  it("rejeita dependência desconhecida", () => {
    const r = HealthResponse.safeParse({
      ...saudavel,
      checks: { ...saudavel.checks, mysql: { status: "ok", latency_ms: 1 } },
    });
    expect(r.success).toBe(false);
  });

  it("rejeita latência negativa", () => {
    const r = HealthResponse.safeParse({
      ...saudavel,
      checks: { ...saudavel.checks, valkey: { status: "ok", latency_ms: -1 } },
    });
    expect(r.success).toBe(false);
  });
});
