import { VoxaError } from "../erros/voxa-error.ts";

/** Início da contagem dos Snowflakes: 2025-01-01T00:00:00Z (docs/04-backend.md §4.2). */
export const EPOCA_SNOWFLAKE = Date.UTC(2025, 0, 1);

export const BITS_WORKER = 10;
export const BITS_SEQUENCIA = 12;
export const MAX_WORKER = (1 << BITS_WORKER) - 1; // 1023
export const MAX_SEQUENCIA = (1 << BITS_SEQUENCIA) - 1; // 4095

/** Maior ID aceito: cabe no `bigint` (com sinal) do Postgres. */
export const MAX_SNOWFLAKE = 2n ** 63n - 1n;

/**
 * Último instante representável. Com o bit de sinal sempre 0, sobram 41 bits de
 * tempo: cerca de 69 anos a partir da época, até meados de 2094.
 */
export const LIMITE_TEMPO_SNOWFLAKE = EPOCA_SNOWFLAKE + 2 ** 41 - 1;

/** Recuo do relógio, em ms, que o gerador absorve esperando. Acima disso, falha. */
export const TOLERANCIA_RELOGIO_MS = 10;

/**
 * Gera IDs Snowflake de 64 bits, ordenáveis por tempo:
 * 1 bit de sinal (sempre 0) · 41 bits de ms desde a época · 10 bits de worker · 12 bits de sequência.
 *
 * `worker` é um número fixo (testes) ou uma função que devolve o worker do lease
 * atual, ou `undefined` enquanto o processo não tem um (docs/04-backend.md §4.2).
 */
export class GeradorSnowflake {
  readonly #worker: () => number | undefined;
  readonly #relogio: () => number;
  #ultimoMs = -1;
  #sequencia = 0;

  constructor(worker: number | (() => number | undefined), relogio: () => number = Date.now) {
    if (typeof worker === "number") validarWorker(worker);
    this.#worker = typeof worker === "number" ? () => worker : worker;
    this.#relogio = relogio;
  }

  gerar(): bigint {
    const worker = this.#worker();
    if (worker === undefined) {
      throw new VoxaError(
        "SERVICE_UNAVAILABLE",
        "Este processo ainda não tem um worker de IDs (Valkey indisponível?).",
      );
    }
    validarWorker(worker);

    let agora = this.#relogio();
    if (agora < this.#ultimoMs) {
      const recuo = this.#ultimoMs - agora;
      if (recuo > TOLERANCIA_RELOGIO_MS) {
        throw new VoxaError(
          "INTERNAL_ERROR",
          `O relógio do sistema voltou ${recuo} ms; a geração de IDs foi suspensa para não repetir IDs.`,
        );
      }
      agora = this.#esperarAte(this.#ultimoMs);
    }

    if (agora > LIMITE_TEMPO_SNOWFLAKE) {
      throw new VoxaError(
        "INTERNAL_ERROR",
        "Data além do limite representável pelos IDs Snowflake.",
      );
    }

    if (agora === this.#ultimoMs) {
      this.#sequencia = (this.#sequencia + 1) & MAX_SEQUENCIA;
      // Sequência esgotada neste ms: espera o próximo.
      if (this.#sequencia === 0) agora = this.#esperarAte(this.#ultimoMs + 1);
    } else {
      this.#sequencia = 0;
    }
    this.#ultimoMs = agora;

    return (
      (BigInt(agora - EPOCA_SNOWFLAKE) << BigInt(BITS_WORKER + BITS_SEQUENCIA)) |
      (BigInt(worker) << BigInt(BITS_SEQUENCIA)) |
      BigInt(this.#sequencia)
    );
  }

  #esperarAte(ms: number): number {
    let agora = this.#relogio();
    while (agora < ms) agora = this.#relogio();
    return agora;
  }
}

function validarWorker(worker: number) {
  if (!Number.isInteger(worker) || worker < 0 || worker > MAX_WORKER) {
    throw new RangeError(`Worker de Snowflake inválido: ${worker} (esperado 0 a ${MAX_WORKER}).`);
  }
}

/** Instante em que o ID foi gerado. */
export function dataDoSnowflake(id: bigint): Date {
  return new Date(Number(id >> BigInt(BITS_WORKER + BITS_SEQUENCIA)) + EPOCA_SNOWFLAKE);
}

/** Worker que gerou o ID. */
export function workerDoSnowflake(id: bigint): number {
  return Number((id >> BigInt(BITS_SEQUENCIA)) & BigInt(MAX_WORKER));
}

/**
 * Converte o ID recebido do cliente (string de dígitos, como vai no JSON) em `bigint`.
 * Lança `VALIDATION_FAILED` para qualquer outra coisa.
 */
export function snowflakeDeString(texto: string): bigint {
  if (/^\d{1,19}$/.test(texto)) {
    const id = BigInt(texto);
    if (id <= MAX_SNOWFLAKE) return id;
  }
  throw new VoxaError("VALIDATION_FAILED", "ID inválido.", { details: { id: texto } });
}
