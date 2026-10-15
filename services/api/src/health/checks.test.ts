import { describe, expect, it } from "vitest";
import { executarVerificacao, motivoSeguro } from "./checks.ts";

describe("executarVerificacao", () => {
  it("devolve ok com a latência", async () => {
    const r = await executarVerificacao(async () => "PONG");
    expect(r.status).toBe("ok");
    expect(r.latency_ms).toBeGreaterThanOrEqual(0);
  });

  it("devolve error com o código de rede, sem a mensagem completa", async () => {
    const falha = Object.assign(new Error("connect ECONNREFUSED postgres://voxa:senha@h"), {
      code: "ECONNREFUSED",
    });
    const r = await executarVerificacao(async () => {
      throw falha;
    });
    expect(r).toMatchObject({ status: "error", error: "ECONNREFUSED" });
    expect(JSON.stringify(r)).not.toContain("senha");
  });

  it("aborta quando a dependência não responde a tempo", async () => {
    let abortado = false;
    const r = await executarVerificacao(
      (sinal) =>
        new Promise(() => {
          sinal.addEventListener("abort", () => {
            abortado = true;
          });
        }),
      50,
    );
    expect(r).toMatchObject({ status: "error", error: "timeout após 50 ms" });
    expect(abortado).toBe(true);
  });
});

describe("motivoSeguro", () => {
  it("usa o nome do erro quando não há código", () => {
    expect(motivoSeguro(new TypeError("detalhe com https://usuario:senha@host"))).toBe("TypeError");
    expect(motivoSeguro("texto")).toBe("erro desconhecido");
  });
});
