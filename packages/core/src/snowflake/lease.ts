import { randomBytes } from "node:crypto";
import type { Valkey } from "iovalkey";
import { MAX_WORKER } from "./gerador.ts";

/** Chave do lease de cada worker no Valkey. */
export const chaveDoWorker = (worker: number) => `snowflake:worker:${worker}`;

// Renova/libera só se o lease ainda for deste processo (o valor guarda o token).
const RENOVAR = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("PEXPIRE", KEYS[1], ARGV[2]) else return 0 end`;
const LIBERAR = `if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end`;

interface Registro {
  info(dados: object, mensagem: string): void;
  warn(dados: object, mensagem: string): void;
}

export interface OpcoesLease {
  valkey: Valkey;
  /** Nome do processo, gravado no lease para facilitar a depuração (ex.: `api-host-123`). */
  dono: string;
  logger?: Registro;
  /** Validade do lease, em ms. */
  ttlMs?: number;
  /** Intervalo entre renovações (e entre tentativas, sem lease), em ms. */
  intervaloMs?: number;
  /** Ponto de partida da busca por um worker livre (padrão: aleatório). */
  inicio?: number;
}

/**
 * Lease do worker de Snowflake no Valkey (docs/04-backend.md §4.2): cada processo
 * reserva um número de 0 a 1023 com `SET NX` e o renova periodicamente. Assim, dois
 * processos nunca geram IDs com o mesmo worker.
 *
 * Sem Valkey, o processo continua no ar (o /health mostra a falha) e tenta de novo
 * a cada `intervaloMs`; enquanto isso, `worker` é `undefined` e não há geração de IDs.
 */
export class LeaseDeWorker {
  readonly #valkey: Valkey;
  readonly #logger: Registro | undefined;
  readonly #ttlMs: number;
  readonly #intervaloMs: number;
  readonly #token: string;
  readonly #inicio: number;
  #worker: number | undefined;
  #ultimaRenovacao = 0;
  #timer: NodeJS.Timeout | undefined;
  #parado = false;
  #emAndamento = false;

  constructor(opcoes: OpcoesLease) {
    this.#valkey = opcoes.valkey;
    this.#logger = opcoes.logger;
    this.#ttlMs = opcoes.ttlMs ?? 30_000;
    this.#intervaloMs = opcoes.intervaloMs ?? 10_000;
    if (this.#intervaloMs * 2 > this.#ttlMs) {
      throw new RangeError("intervaloMs precisa ser no máximo metade de ttlMs.");
    }
    this.#token = `${opcoes.dono}:${randomBytes(8).toString("hex")}`;
    this.#inicio = opcoes.inicio ?? Math.floor(Math.random() * (MAX_WORKER + 1));
  }

  /** Worker reservado por este processo, ou `undefined` se não houver lease válido. */
  get worker(): number | undefined {
    // Sem renovar a tempo, o lease pode ter expirado e outro processo pode tê-lo pegado.
    if (Date.now() - this.#ultimaRenovacao > this.#ttlMs - this.#intervaloMs) return undefined;
    return this.#worker;
  }

  /** Tenta reservar um worker já e agenda as renovações. Não lança: sem Valkey, tenta depois. */
  async iniciar(): Promise<void> {
    await this.#ciclo();
    this.#timer = setInterval(() => void this.#ciclo(), this.#intervaloMs);
    this.#timer.unref();
  }

  /** Para as renovações e devolve o worker, para outro processo poder usá-lo. */
  async liberar(): Promise<void> {
    this.#parado = true;
    clearInterval(this.#timer);
    const worker = this.#worker;
    this.#worker = undefined;
    if (worker === undefined) return;
    await this.#valkey.eval(LIBERAR, 1, chaveDoWorker(worker), this.#token).catch(() => {});
  }

  async #ciclo(): Promise<void> {
    // Um ciclo lento (Valkey reconectando) não pode se sobrepor ao seguinte e reservar dois workers.
    if (this.#parado || this.#emAndamento) return;
    this.#emAndamento = true;
    try {
      if (this.#worker === undefined) await this.#reservar();
      else await this.#renovar(this.#worker);
    } catch (erro) {
      this.#logger?.warn(
        { motivo: (erro as Error).message, worker: this.#worker },
        "lease do worker de IDs: Valkey indisponível",
      );
    } finally {
      this.#emAndamento = false;
    }
  }

  async #reservar(): Promise<void> {
    for (let i = 0; i <= MAX_WORKER; i++) {
      const worker = (this.#inicio + i) % (MAX_WORKER + 1);
      const ok = await this.#valkey.set(
        chaveDoWorker(worker),
        this.#token,
        "PX",
        this.#ttlMs,
        "NX",
      );
      if (ok === "OK") {
        this.#worker = worker;
        this.#ultimaRenovacao = Date.now();
        this.#logger?.info({ worker }, "worker de IDs reservado");
        return;
      }
    }
    this.#logger?.warn({}, `todos os ${MAX_WORKER + 1} workers de IDs estão ocupados`);
  }

  async #renovar(worker: number): Promise<void> {
    const antes = Date.now();
    const renovou = await this.#valkey.eval(
      RENOVAR,
      1,
      chaveDoWorker(worker),
      this.#token,
      this.#ttlMs,
    );
    if (renovou === 1) {
      this.#ultimaRenovacao = antes;
      return;
    }
    // Expirou e talvez já seja de outro processo: larga e reserva outro.
    this.#logger?.warn({ worker }, "lease do worker de IDs perdido; reservando outro");
    this.#worker = undefined;
    await this.#reservar();
  }
}
