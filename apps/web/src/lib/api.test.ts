import { describe, expect, it, vi } from "vitest";
import { lerSaude } from "./api.ts";

const saudavel = {
  status: "ok",
  version: "0.0.0",
  uptime_s: 3,
  checks: {
    postgres: { status: "ok", latency_ms: 1 },
    valkey: { status: "ok", latency_ms: 1 },
    s3: { status: "ok", latency_ms: 1 },
    livekit: { status: "ok", latency_ms: 1 },
  },
};

const resposta = (status: number, corpo: unknown) =>
  vi
    .fn()
    .mockResolvedValue(
      new Response(typeof corpo === "string" ? corpo : JSON.stringify(corpo), { status }),
    );

describe("lerSaude", () => {
  it("consulta /api/v1/health e valida a resposta", async () => {
    const f = resposta(200, saudavel);
    expect(await lerSaude(f)).toEqual({ tipo: "resposta", http: 200, saude: saudavel });
    expect(f).toHaveBeenCalledWith(
      "/api/v1/health",
      expect.objectContaining({ headers: { accept: "application/json" } }),
    );
  });

  it("503 com corpo válido continua sendo uma resposta (a API está no ar, uma dependência não)", async () => {
    const corpo = { ...saudavel, status: "error" };
    expect(await lerSaude(resposta(503, corpo))).toMatchObject({ tipo: "resposta", http: 503 });
  });

  it("502 do proxy sem corpo da API: API fora do ar", async () => {
    expect(await lerSaude(resposta(502, ""))).toEqual({
      tipo: "inacessivel",
      motivo: "API fora do ar (o proxy respondeu HTTP 502)",
    });
  });

  it("corpo fora do contrato: resposta inesperada", async () => {
    expect(await lerSaude(resposta(200, { outra: "coisa" }))).toEqual({
      tipo: "inacessivel",
      motivo: "resposta inesperada da API (HTTP 200)",
    });
  });

  it("falha de rede: inacessível, sem lançar erro", async () => {
    const f = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await lerSaude(f)).toMatchObject({ tipo: "inacessivel" });
  });
});
