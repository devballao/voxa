// Ponto de entrada da API: carrega a configuração, cria os clientes e abre a porta.
import { readFileSync } from "node:fs";
import { hostname } from "node:os";
import { S3Client } from "@aws-sdk/client-s3";
import { LeaseDeWorker } from "@voxa/core";
import { createDb } from "@voxa/db";
import { Valkey } from "iovalkey";
import { RoomServiceClient } from "livekit-server-sdk";
import { CAMPOS_OCULTOS_NO_LOG, construirApp, serializarRequisicao } from "./app.ts";
import { carregarConfig, ErroDeConfiguracao } from "./config.ts";
import { criarVerificacoes } from "./health/checks.ts";

const { version } = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

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

const db = createDb({ url: config.DATABASE_URL });
const valkey = new Valkey(config.VALKEY_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});
// Uma falha de conexão não deve derrubar o processo: o /health a reporta.
valkey.on("error", () => {});
await valkey.connect().catch(() => {});

const s3 = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: config.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: config.S3_ACCESS_KEY_ID,
    secretAccessKey: config.S3_SECRET_ACCESS_KEY,
  },
});
const livekit = new RoomServiceClient(
  config.LIVEKIT_URL.replace(/^ws/, "http"),
  config.LIVEKIT_API_KEY,
  config.LIVEKIT_API_SECRET,
);

const app = await construirApp({
  versao: version,
  verificacoes: criarVerificacoes({ db, valkey, s3, s3Bucket: config.S3_BUCKET, livekit }),
  logger: {
    level: config.LOG_LEVEL,
    redact: { paths: CAMPOS_OCULTOS_NO_LOG, censor: "[oculto]" },
    serializers: { req: serializarRequisicao },
    ...(config.NODE_ENV === "development"
      ? {
          transport: {
            target: "pino-pretty",
            options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
          },
        }
      : {}),
  },
});

// Worker de IDs (Snowflake): reservado no Valkey e renovado em segundo plano.
const lease = new LeaseDeWorker({
  valkey,
  dono: `api-${hostname()}-${process.pid}`,
  logger: app.log,
});
await lease.iniciar();

app.addHook("onClose", async () => {
  await lease.liberar();
  await Promise.allSettled([db.close(), valkey.quit()]);
  s3.destroy();
});

let encerrando = false;
for (const sinal of ["SIGTERM", "SIGINT"] as const) {
  process.on(sinal, async () => {
    if (encerrando) return;
    encerrando = true;
    app.log.info({ sinal }, "encerrando: fechando conexões");
    const forcar = setTimeout(() => process.exit(1), 10_000).unref();
    await app.close();
    clearTimeout(forcar);
    process.exit(0);
  });
}

await app.listen({ host: config.API_HOST, port: config.API_PORT });
