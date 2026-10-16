import { describe, expect, it } from "vitest";
import { verificar } from "./saude.ts";

describe("verificar", () => {
  it("ok com latência", async () => {
    expect(await verificar(async () => "PONG")).toMatchObject({ status: "ok" });
  });

  it("erro de rede: só o código, sem a mensagem", async () => {
    const r = await verificar(async () => {
      throw Object.assign(new Error("redis://:senha@host"), { code: "ECONNREFUSED" });
    });
    expect(r).toMatchObject({ status: "error", error: "ECONNREFUSED" });
    expect(JSON.stringify(r)).not.toContain("senha");
  });

  it("timeout", async () => {
    const r = await verificar(() => new Promise(() => {}), 30);
    expect(r).toMatchObject({ status: "error", error: "timeout após 30 ms" });
  });

  it("erro sem código usa o nome; valor que não é Error vira 'erro desconhecido'", async () => {
    expect(
      await verificar(async () => {
        throw new TypeError("detalhe");
      }),
    ).toMatchObject({ error: "TypeError" });
    expect(
      await verificar(async () => {
        throw "texto";
      }),
    ).toMatchObject({ error: "erro desconhecido" });
  });
});
