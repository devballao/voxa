import { randomBytes } from "node:crypto";
import { integracaoDisponivel } from "@voxa/config/vitest";
import { Valkey } from "iovalkey";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { type Config, carregarConfig } from "../../src/config.ts";
import { iniciarConsumidor, type Tarefa } from "../../src/consumidor.ts";

function configDeDesenvolvimento(): Config | undefined {
  try {
    return carregarConfig();
  } catch {
    return undefined;
  }
}

const config = configDeDesenvolvimento();
const rodar = integracaoDisponivel(
  config !== undefined,
  "Rode `pnpm dev:infra` e `cp .env.example .env` na raiz.",
);

describe.skipIf(!rodar)("consumidor com o Valkey real (requer pnpm dev:infra)", () => {
  // Stream descartável: não interfere no dev:jobs de um worker rodando.
  const stream = `teste:jobs:${randomBytes(4).toString("hex")}`;
  const grupo = "voxa-workers-teste";
  let valkey: Valkey;
  let produtor: Valkey;

  beforeAll(() => {
    const c = config as Config;
    valkey = new Valkey(c.VALKEY_URL, { maxRetriesPerRequest: null });
    produtor = new Valkey(c.VALKEY_URL);
  });

  afterAll(async () => {
    await produtor?.del(stream);
    await Promise.allSettled([valkey?.quit(), produtor?.quit()]);
  });

  it("XADD → tarefa processada e confirmada; tarefa que falha fica pendente", async () => {
    const processadas: Tarefa[] = [];
    const c = iniciarConsumidor({
      valkey,
      logger: pino({ level: "silent" }),
      stream,
      grupo,
      consumidor: "teste-1",
      esperaMs: 200,
      processar: async (t) => {
        processadas.push(t);
        if (t.campos.tipo === "quebra") throw new Error("falha simulada");
      },
    });
    // Espera o grupo existir antes de produzir (o grupo lê só tarefas novas: "$").
    await vi.waitFor(async () => expect(await produtor.exists(stream)).toBe(1));
    await produtor.xadd(stream, "*", "tipo", "teste");
    await produtor.xadd(stream, "*", "tipo", "quebra");

    await vi.waitFor(() => expect(processadas).toHaveLength(2), { timeout: 3000 });
    c.parar();
    await c.concluido;

    expect(processadas.map((t) => t.campos)).toEqual([{ tipo: "teste" }, { tipo: "quebra" }]);
    const [pendentes] = (await produtor.xpending(stream, grupo)) as [number];
    expect(pendentes).toBe(1);
  });
});
