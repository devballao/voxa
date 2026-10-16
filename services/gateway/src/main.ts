// Ponto de entrada do gateway: carrega a configuração, conecta ao Valkey e abre a porta.
import { Valkey } from "iovalkey";
import { pino } from "pino";
import { carregarConfig, ErroDeConfiguracao } from "./config.ts";
import { ligarDevPing } from "./dev-ping.ts";
import { criarGateway } from "./gateway.ts";
import { verificar } from "./saude.ts";

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
  name: "gateway",
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

// Uma conexão em modo SUBSCRIBE não executa outros comandos: duas conexões.
const opcoesValkey = { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false };
const valkey = new Valkey(config.VALKEY_URL, opcoesValkey);
const assinante = new Valkey(config.VALKEY_URL, { ...opcoesValkey, enableOfflineQueue: true });
for (const conexao of [valkey, assinante]) {
  // Falhas de conexão não derrubam o processo: o /health as reporta e o cliente reconecta.
  conexao.on("error", (erro) => logger.warn({ motivo: erro.message }, "valkey indisponível"));
}
await Promise.allSettled([valkey.connect(), assinante.connect()]);

const gateway = criarGateway({
  heartbeatIntervalMs: config.GATEWAY_HEARTBEAT_INTERVAL_MS,
  logger,
  verificarSaude: async () => ({ valkey: await verificar(() => valkey.ping()) }),
});

if (config.NODE_ENV !== "production") {
  await ligarDevPing(assinante, gateway, logger).catch((erro: Error) =>
    logger.warn({ motivo: erro.message }, "dev:ping indisponível"),
  );
}

let encerrando = false;
for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, async () => {
    if (encerrando) return;
    encerrando = true;
    logger.info({ sinal, conexoes: gateway.conexoes }, "encerrando: avisando clientes (RECONNECT)");
    const forcar = setTimeout(() => process.exit(1), 10_000).unref();
    await gateway.close();
    await Promise.allSettled([valkey.quit(), assinante.quit()]);
    clearTimeout(forcar);
    process.exit(0);
  });
}

gateway.server.listen(config.GATEWAY_PORT, config.GATEWAY_HOST, () => {
  logger.info(`gateway ouvindo em ws://${config.GATEWAY_HOST}:${config.GATEWAY_PORT}/gateway`);
});
