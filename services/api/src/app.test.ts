import { VoxaError } from "@voxa/core";
import type { HealthDependency } from "@voxa/protocol/http";
import { ErrorResponse, HealthResponse } from "@voxa/protocol/http";
import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { construirApp, serializarRequisicao, truncarIp } from "./app.ts";
import type { Verificacoes } from "./health/checks.ts";

const ok = async () => "ok";
const tudoOk: Verificacoes = { postgres: ok, valkey: ok, s3: ok, livekit: ok };

let app: Awaited<ReturnType<typeof construirApp>> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function montar(verificacoes: Verificacoes = tudoOk) {
  app = await construirApp({ verificacoes, versao: "1.2.3" });
  return app;
}

describe("GET /api/v1/health", () => {
  it("200 quando todas as dependências estão ok", async () => {
    const res = await (await montar()).inject({ method: "GET", url: "/api/v1/health" });
    expect(res.statusCode).toBe(200);
    const corpo = HealthResponse.parse(res.json());
    expect(corpo.status).toBe("ok");
    expect(corpo.version).toBe("1.2.3");
    expect(Object.keys(corpo.checks).sort()).toEqual(["livekit", "postgres", "s3", "valkey"]);
  });

  it.each<HealthDependency>(["postgres", "valkey", "s3", "livekit"])(
    "503 indicando a falha quando %s está fora",
    async (dependencia) => {
      const falha = async () => {
        throw Object.assign(new Error("x"), { code: "ECONNREFUSED" });
      };
      const res = await (await montar({ ...tudoOk, [dependencia]: falha })).inject({
        method: "GET",
        url: "/api/v1/health",
      });
      expect(res.statusCode).toBe(503);
      const corpo = HealthResponse.parse(res.json());
      expect(corpo.status).toBe("error");
      expect(corpo.checks[dependencia]).toMatchObject({ status: "error", error: "ECONNREFUSED" });
      const outras = Object.entries(corpo.checks).filter(([n]) => n !== dependencia);
      expect(outras.every(([, c]) => c.status === "ok")).toBe(true);
    },
  );
});

describe("erros no formato padrão", () => {
  it("404 para rota inexistente, sem ecoar a query string", async () => {
    const res = await (await montar()).inject({ method: "GET", url: "/api/v1/nada?token=x" });
    expect(res.statusCode).toBe(404);
    const corpo = ErrorResponse.parse(res.json());
    expect(corpo.error.code).toBe("NOT_FOUND");
    expect(corpo.error.message).not.toContain("token");
  });

  it("400 VALIDATION_FAILED quando o corpo não passa no esquema Zod", async () => {
    const a = await montar();
    a.post("/teste", { schema: { body: z.object({ nome: z.string().min(1) }) } }, async () => ({}));
    const res = await a.inject({ method: "POST", url: "/teste", payload: { nome: "" } });
    expect(res.statusCode).toBe(400);
    const corpo = ErrorResponse.parse(res.json());
    expect(corpo.error.code).toBe("VALIDATION_FAILED");
    expect(corpo.error.details?.issues).toBeInstanceOf(Array);
  });

  it("500 INTERNAL_ERROR sem expor a mensagem interna", async () => {
    const a = await montar();
    a.get("/explode", async () => {
      throw new Error("detalhe interno com senha");
    });
    const res = await a.inject({ method: "GET", url: "/explode" });
    expect(res.statusCode).toBe(500);
    const corpo = ErrorResponse.parse(res.json());
    expect(corpo.error.code).toBe("INTERNAL_ERROR");
    expect(res.body).not.toContain("senha");
  });

  it("repassa erros 4xx e 429 do Fastify no formato padrão", async () => {
    const a = await montar();
    a.get("/limite", async () => {
      throw Object.assign(new Error("lento"), { statusCode: 429 });
    });
    a.get("/proibido", async () => {
      throw Object.assign(new Error("Corpo vazio"), { statusCode: 415 });
    });
    const limite = await a.inject({ method: "GET", url: "/limite" });
    expect(limite.statusCode).toBe(429);
    expect(ErrorResponse.parse(limite.json()).error.code).toBe("RATE_LIMITED");
    const proibido = await a.inject({ method: "GET", url: "/proibido" });
    expect(proibido.statusCode).toBe(415);
    expect(ErrorResponse.parse(proibido.json()).error.message).toBe("Corpo vazio");
  });

  it("converte VoxaError com o status, o código e os detalhes do domínio", async () => {
    const a = await montar();
    a.get("/canal", async () => {
      throw new VoxaError("MISSING_PERMISSION", "Sem permissão para enviar mensagens.", {
        details: { permission: "SEND_MESSAGES" },
      });
    });
    const res = await a.inject({ method: "GET", url: "/canal" });
    expect(res.statusCode).toBe(403);
    expect(ErrorResponse.parse(res.json())).toEqual({
      error: {
        code: "MISSING_PERMISSION",
        message: "Sem permissão para enviar mensagens.",
        details: { permission: "SEND_MESSAGES" },
      },
    });
  });
});

describe("log sem dados sensíveis", () => {
  it("serializa só o caminho e o IP truncado", () => {
    expect(
      serializarRequisicao({ method: "GET", url: "/api/v1/x?token=abc", ip: "203.0.113.57" }),
    ).toEqual({ method: "GET", path: "/api/v1/x", ip: "203.0.113.0" });
  });

  it("trunca IPv4, IPv4 mapeado e IPv6", () => {
    expect(truncarIp("10.1.2.3")).toBe("10.1.2.0");
    expect(truncarIp("::ffff:10.1.2.3")).toBe("10.1.2.0");
    expect(truncarIp("2001:db8:abcd:12:1:2:3:4")).toBe("2001:db8:abcd::");
    expect(truncarIp(undefined)).toBeUndefined();
  });
});
