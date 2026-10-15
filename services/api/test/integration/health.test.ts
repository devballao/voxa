import { S3Client } from "@aws-sdk/client-s3";
import { integracaoDisponivel } from "@voxa/config/vitest";
import { createDb } from "@voxa/db";
import { HealthResponse } from "@voxa/protocol/http";
import { Valkey } from "iovalkey";
import { RoomServiceClient } from "livekit-server-sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirApp } from "../../src/app.ts";
import { type Config, carregarConfig } from "../../src/config.ts";
import { type ClientesDasDependencias, criarVerificacoes } from "../../src/health/checks.ts";

/** Configuração real do .env da raiz, se houver. Sem ela, o teste é pulado. */
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

describe.skipIf(!rodar)(
  "GET /api/v1/health com as dependências reais (requer pnpm dev:infra)",
  () => {
    // Conexões criadas no beforeAll: o corpo do describe roda mesmo quando
    // os testes são pulados, e aqui não há configuração nesse caso.
    let clientes: ClientesDasDependencias;

    beforeAll(() => {
      const c = config as Config;
      clientes = {
        db: createDb({ url: c.DATABASE_URL, max: 1 }),
        valkey: new Valkey(c.VALKEY_URL, { maxRetriesPerRequest: 1 }),
        s3: new S3Client({
          endpoint: c.S3_ENDPOINT,
          region: c.S3_REGION,
          forcePathStyle: c.S3_FORCE_PATH_STYLE,
          credentials: {
            accessKeyId: c.S3_ACCESS_KEY_ID,
            secretAccessKey: c.S3_SECRET_ACCESS_KEY,
          },
        }),
        s3Bucket: c.S3_BUCKET,
        livekit: new RoomServiceClient(
          c.LIVEKIT_URL.replace(/^ws/, "http"),
          c.LIVEKIT_API_KEY,
          c.LIVEKIT_API_SECRET,
        ),
      };
    });

    afterAll(async () => {
      if (!clientes) return;
      await Promise.allSettled([clientes.db.close(), clientes.valkey.quit()]);
      clientes.s3.destroy();
    });

    it("responde 200 com Postgres, Valkey, S3 e LiveKit ok", async () => {
      const app = await construirApp({
        versao: "teste",
        verificacoes: criarVerificacoes(clientes),
      });
      const res = await app.inject({ method: "GET", url: "/api/v1/health" });
      await app.close();

      const corpo = HealthResponse.parse(res.json());
      expect(res.statusCode, JSON.stringify(corpo.checks)).toBe(200);
      for (const check of Object.values(corpo.checks)) expect(check.status).toBe("ok");
    });
  },
);
