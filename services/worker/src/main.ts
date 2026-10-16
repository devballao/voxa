// Ponto de entrada do worker: conecta ao Valkey e consome as filas.
import { hostname } from "node:os";
import { Valkey } from "iovalkey";
import { pino } from "pino";
import { carregarConfig, ErroDeConfiguracao } from "./config.ts";
import { iniciarConsumidor } from "./consumidor.ts";

/** Fila de desenvolvimento: prova o caminho das tarefas (XADD dev:jobs * tipo teste). */
export const STREAM_DEV_JOBS = "dev:jobs";
export const GRUPO = "voxa-workers";

let config: ReturnType<typeof carregarConfig>;
try {
  config = carregarConfig();
} catch (e) {
  if (e instanceof ErroDeConfiguracao) {
    console.error(`✗ ${e.message}\n\nEm desenvolvimento: cp .env.example .env (na raiz).`);
    process.exit(1);
  }
  throw e;
}

const logger = pino({
  name: "worker",
  level: config.LOG_LEVEL,
  ...(config.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
        },
      }
    : {}),
});

const valkey = new Valkey(config.VALKEY_URL, { maxRetriesPerRequest: null });
valkey.on("error", (erro) => logger.warn({ motivo: erro.message }, "valkey indisponível"));

const consumidores = [
  iniciarConsumidor({
    valkey,
    logger,
    stream: STREAM_DEV_JOBS,
    grupo: GRUPO,
    consumidor: config.WORKER_NAME ?? `${hostname()}-${process.pid}`,
    processar: async (tarefa) => {
      logger.info({ id: tarefa.id, campos: tarefa.campos }, "tarefa processada (dev:jobs)");
    },
  }),
];

let encerrando = false;
for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, async () => {
    if (encerrando) return;
    encerrando = true;
    logger.info({ sinal }, "encerrando: terminando a leitura em andamento");
    const forcar = setTimeout(() => process.exit(1), 10_000).unref();
    for (const c of consumidores) c.parar();
    await Promise.allSettled(consumidores.map((c) => c.concluido));
    await valkey.quit().catch(() => {});
    clearTimeout(forcar);
    process.exit(0);
  });
}
