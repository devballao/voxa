import { describe, expect, it } from "vitest";
import { VoxaError } from "../erros/voxa-error.ts";
import {
  dataDoSnowflake,
  EPOCA_SNOWFLAKE,
  GeradorSnowflake,
  LIMITE_TEMPO_SNOWFLAKE,
  MAX_SEQUENCIA,
  snowflakeDeString,
  TOLERANCIA_RELOGIO_MS,
  workerDoSnowflake,
} from "./gerador.ts";

/** Relógio controlado pelo teste; `passo` avança o tempo a cada leitura. */
function relogioFalso(inicio: number, passo = 0) {
  let agora = inicio;
  const relogio = () => {
    const valor = agora;
    agora += passo;
    return valor;
  };
  relogio.definir = (ms: number) => {
    agora = ms;
  };
  return relogio;
}

describe("GeradorSnowflake", () => {
  it("gera 100 mil IDs únicos e crescentes", () => {
    const gerador = new GeradorSnowflake(7);
    const ids = Array.from({ length: 100_000 }, () => gerador.gerar());
    expect(new Set(ids).size).toBe(ids.length);
    for (let i = 1; i < ids.length; i++)
      expect((ids[i] as bigint) > (ids[i - 1] as bigint)).toBe(true);
  });

  it("codifica o instante e o worker no ID", () => {
    const instante = Date.UTC(2026, 9, 16, 12, 0, 0);
    const id = new GeradorSnowflake(513, () => instante).gerar();
    expect(dataDoSnowflake(id).getTime()).toBe(instante);
    expect(workerDoSnowflake(id)).toBe(513);
    expect(id & BigInt(MAX_SEQUENCIA)).toBe(0n);
  });

  it("espera o próximo ms quando a sequência do ms se esgota", () => {
    // 4097 leituras no mesmo ms: a última esgota a sequência e espera o próximo ms.
    let leituras = 0;
    const inicio = EPOCA_SNOWFLAKE + 1_000;
    const gerador = new GeradorSnowflake(1, () =>
      leituras++ < MAX_SEQUENCIA + 2 ? inicio : inicio + 1,
    );
    const ids = Array.from({ length: MAX_SEQUENCIA + 2 }, () => gerador.gerar());
    const ultimo = ids.at(-1) as bigint;
    expect(dataDoSnowflake(ultimo).getTime()).toBe(inicio + 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("absorve um recuo pequeno do relógio sem repetir IDs", () => {
    const leituras = [10_000, 10_000, 9_995, 9_997, 10_000, 10_001].map(
      (ms) => EPOCA_SNOWFLAKE + ms,
    );
    let i = 0;
    const gerador = new GeradorSnowflake(
      3,
      () => leituras[Math.min(i++, leituras.length - 1)] as number,
    );
    const ids = [gerador.gerar(), gerador.gerar(), gerador.gerar(), gerador.gerar()];
    expect(new Set(ids).size).toBe(4);
    for (let j = 1; j < ids.length; j++)
      expect((ids[j] as bigint) > (ids[j - 1] as bigint)).toBe(true);
  });

  it("falha com erro claro quando o relógio volta além da tolerância", () => {
    const relogio = relogioFalso(EPOCA_SNOWFLAKE + 10_000);
    const gerador = new GeradorSnowflake(4, relogio);
    gerador.gerar();
    relogio.definir(EPOCA_SNOWFLAKE + 10_000 - TOLERANCIA_RELOGIO_MS - 1);
    expect(() => gerador.gerar()).toThrow(/relógio do sistema voltou/);
  });

  it("recusa datas além do limite do bigint do Postgres (~2094)", () => {
    const gerador = new GeradorSnowflake(1, () => LIMITE_TEMPO_SNOWFLAKE + 1);
    expect(() => gerador.gerar()).toThrow(/limite representável/);
    const ultimo = new GeradorSnowflake(1023, () => LIMITE_TEMPO_SNOWFLAKE).gerar();
    expect(ultimo <= 2n ** 63n - 1n).toBe(true);
  });

  it("recusa gerar sem worker (lease ainda não obtido)", () => {
    const gerador = new GeradorSnowflake(() => undefined);
    expect(() => gerador.gerar()).toThrow(VoxaError);
    try {
      gerador.gerar();
    } catch (erro) {
      expect((erro as VoxaError).code).toBe("SERVICE_UNAVAILABLE");
    }
  });

  it.each([-1, 1024, 1.5])("recusa o worker inválido %s", (worker) => {
    expect(() => new GeradorSnowflake(worker)).toThrow(RangeError);
  });
});

describe("snowflakeDeString", () => {
  it("passa pelo JSON sem perder precisão acima de 2⁵³", () => {
    const id = new GeradorSnowflake(1023, () => Date.UTC(2090, 0, 1)).gerar();
    expect(id > BigInt(Number.MAX_SAFE_INTEGER)).toBe(true);
    const json = JSON.stringify({ id: String(id) });
    expect(snowflakeDeString(JSON.parse(json).id)).toBe(id);
  });

  it.each(["", "-1", "12a", "1e5", "9223372036854775808", " 1"])("rejeita %j", (texto) => {
    expect(() => snowflakeDeString(texto)).toThrow(VoxaError);
  });
});
