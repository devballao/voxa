import { ErrorCode, ErrorResponse } from "@voxa/protocol/http";
import { describe, expect, it } from "vitest";
import { STATUS_POR_CODIGO, VoxaError } from "./voxa-error.ts";

describe("VoxaError", () => {
  it("guarda código, mensagem e detalhes", () => {
    const erro = new VoxaError("MISSING_PERMISSION", "Sem permissão para enviar mensagens.", {
      details: { permission: "SEND_MESSAGES" },
    });
    expect(erro).toBeInstanceOf(Error);
    expect(erro.name).toBe("VoxaError");
    expect(erro.code).toBe("MISSING_PERMISSION");
    expect(erro.message).toBe("Sem permissão para enviar mensagens.");
    expect(erro.details).toEqual({ permission: "SEND_MESSAGES" });
    expect(erro.status).toBe(403);
  });

  it("converte para o formato de erro do protocolo", () => {
    const corpo = new VoxaError("NOT_FOUND", "Canal não encontrado.", {
      details: { channel_id: "123" },
    }).paraResposta();
    expect(ErrorResponse.parse(corpo)).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Canal não encontrado.",
        details: { channel_id: "123" },
      },
    });
  });

  it("omite `details` quando não há detalhes", () => {
    expect(new VoxaError("CONFLICT", "Nome de usuário em uso.").paraResposta()).toEqual({
      error: { code: "CONFLICT", message: "Nome de usuário em uso." },
    });
  });

  it("preserva a causa original para o log", () => {
    const causa = new Error("timeout do Postgres");
    const erro = new VoxaError("SERVICE_UNAVAILABLE", "Banco indisponível.", { cause: causa });
    expect(erro.cause).toBe(causa);
  });

  it("tem um status HTTP para cada código do protocolo", () => {
    for (const code of ErrorCode.options) {
      expect(STATUS_POR_CODIGO[code]).toBeGreaterThanOrEqual(400);
    }
  });
});
