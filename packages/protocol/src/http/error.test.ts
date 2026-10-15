import { describe, expect, it } from "vitest";
import { ErrorResponse } from "./error.ts";

describe("ErrorResponse", () => {
  it("aceita o formato padrão, com ou sem details", () => {
    expect(
      ErrorResponse.parse({ error: { code: "NOT_FOUND", message: "Canal não encontrado" } }),
    ).toEqual({ error: { code: "NOT_FOUND", message: "Canal não encontrado" } });

    const comDetalhes = {
      error: {
        code: "MISSING_PERMISSION",
        message: "Sem permissão",
        details: { permission: "SEND_MESSAGES" },
      },
    };
    expect(ErrorResponse.parse(comDetalhes)).toEqual(comDetalhes);
  });

  it("rejeita código desconhecido", () => {
    const r = ErrorResponse.safeParse({ error: { code: "OOPS", message: "x" } });
    expect(r.success).toBe(false);
  });

  it("rejeita mensagem vazia ou ausente", () => {
    expect(ErrorResponse.safeParse({ error: { code: "NOT_FOUND", message: "" } }).success).toBe(
      false,
    );
    expect(ErrorResponse.safeParse({ error: { code: "NOT_FOUND" } }).success).toBe(false);
  });
});
