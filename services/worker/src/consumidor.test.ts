import type { Valkey } from "iovalkey";
import { pino } from "pino";
import { describe, expect, it, vi } from "vitest";
import { converterResposta, garantirGrupo, iniciarConsumidor, type Tarefa } from "./consumidor.ts";

const silencioso = pino({ level: "silent" });

describe("converterResposta", () => {
  it("converte a resposta do XREADGROUP em tarefas", () => {
    const resposta = [
      [
        "dev:jobs",
        [
          ["1-0", ["tipo", "teste", "n", "1"]],
          ["2-0", ["tipo", "outro"]],
        ],
      ],
    ];
    expect(converterResposta(resposta)).toEqual([
      { id: "1-0", campos: { tipo: "teste", n: "1" } },
      { id: "2-0", campos: { tipo: "outro" } },
    ]);
  });

  it("resposta vazia (timeout do BLOCK) vira lista vazia", () => {
    expect(converterResposta(null)).toEqual([]);
  });
});

describe("garantirGrupo", () => {
  it("ignora BUSYGROUP (grupo já existe) e propaga outros erros", async () => {
    const existe = {
      xgroup: vi.fn().mockRejectedValue(new Error("BUSYGROUP Consumer Group name already exists")),
    };
    await expect(garantirGrupo(existe as unknown as Valkey, "s", "g")).resolves.toBeUndefined();

    const outro = { xgroup: vi.fn().mockRejectedValue(new Error("WRONGTYPE")) };
    await expect(garantirGrupo(outro as unknown as Valkey, "s", "g")).rejects.toThrow("WRONGTYPE");
  });
});

/** Valkey simulado: devolve as respostas da fila uma por leitura; depois, nada. */
function valkeyFalso(respostas: unknown[]) {
  return {
    xgroup: vi.fn().mockResolvedValue("OK"),
    xreadgroup: vi.fn(async () => {
      const proxima = respostas.shift();
      if (proxima instanceof Error) throw proxima;
      if (proxima === undefined) await new Promise((r) => setTimeout(r, 5));
      return proxima ?? null;
    }),
    xack: vi.fn().mockResolvedValue(1),
  };
}

describe("iniciarConsumidor", () => {
  it("processa e confirma (XACK) cada tarefa; tarefa que falha não é confirmada", async () => {
    const valkey = valkeyFalso([
      [
        [
          "s",
          [
            ["1-0", ["ok", "1"]],
            ["2-0", ["falha", "1"]],
          ],
        ],
      ],
    ]);
    const processadas: Tarefa[] = [];
    const c = iniciarConsumidor({
      valkey: valkey as unknown as Valkey,
      logger: silencioso,
      stream: "s",
      grupo: "g",
      consumidor: "c1",
      esperaMs: 5,
      processar: async (t) => {
        processadas.push(t);
        if (t.campos.falha) throw new Error("falhou");
      },
    });
    await vi.waitFor(() => expect(processadas).toHaveLength(2));
    c.parar();
    await c.concluido;

    expect(valkey.xack).toHaveBeenCalledTimes(1);
    expect(valkey.xack).toHaveBeenCalledWith("s", "g", "1-0");
    expect(valkey.xreadgroup).toHaveBeenCalledWith(
      "GROUP",
      "g",
      "c1",
      "COUNT",
      10,
      "BLOCK",
      5,
      "STREAMS",
      "s",
      ">",
    );
  });

  it("falha de leitura: espera e tenta de novo, sem derrubar o laço", async () => {
    const valkey = valkeyFalso([new Error("conexão perdida"), [["s", [["3-0", ["x", "1"]]]]]]);
    const processar = vi.fn().mockResolvedValue(undefined);
    const c = iniciarConsumidor({
      valkey: valkey as unknown as Valkey,
      logger: silencioso,
      stream: "s",
      grupo: "g",
      consumidor: "c1",
      esperaMs: 5,
      processar,
    });
    await vi.waitFor(() => expect(processar).toHaveBeenCalledTimes(1));
    c.parar();
    await c.concluido;
    expect(valkey.xack).toHaveBeenCalledWith("s", "g", "3-0");
  });

  it("erro de leitura depois de parar() encerra o laço sem nova tentativa", async () => {
    let chamadas = 0;
    let c: ReturnType<typeof iniciarConsumidor> | undefined;
    const valkey = {
      xgroup: vi.fn().mockResolvedValue("OK"),
      xreadgroup: vi.fn(async () => {
        chamadas += 1;
        c?.parar();
        throw new Error("conexão fechada no encerramento");
      }),
      xack: vi.fn(),
    };
    c = iniciarConsumidor({
      valkey: valkey as unknown as Valkey,
      logger: silencioso,
      stream: "s",
      grupo: "g",
      consumidor: "c1",
      esperaMs: 5,
      processar: vi.fn(),
    });
    await c.concluido;
    expect(chamadas).toBe(1);
  });
});
