import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envDaRaiz = fileURLToPath(new URL("../../../.env", import.meta.url));

const booleano = z.enum(["true", "false", "1", "0"]).transform((v) => v === "true" || v === "1");

/** Variáveis de ambiente da API. Qualquer ausência ou erro impede a inicialização. */
const EsquemaEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  VALKEY_URL: z.url({ protocol: /^rediss?$/ }),

  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  S3_FORCE_PATH_STYLE: booleano.default(false),

  LIVEKIT_URL: z.url({ protocol: /^(wss?|https?)$/ }),
  LIVEKIT_API_KEY: z.string().min(1),
  LIVEKIT_API_SECRET: z.string().min(32, "o LiveKit exige segredos com 32+ caracteres"),
});

export type Config = z.infer<typeof EsquemaEnv>;

export class ErroDeConfiguracao extends Error {
  readonly problemas: string[];

  constructor(problemas: string[]) {
    super(`Configuração inválida:\n${problemas.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ErroDeConfiguracao";
    this.problemas = problemas;
  }
}

/**
 * Lê e valida a configuração. Fora de produção, carrega antes o `.env` da raiz
 * (se existir); variáveis já definidas no ambiente têm prioridade.
 */
export function carregarConfig(env: NodeJS.ProcessEnv = process.env): Config {
  if (env === process.env && env.NODE_ENV !== "production" && existsSync(envDaRaiz)) {
    process.loadEnvFile(envDaRaiz);
  }
  const resultado = EsquemaEnv.safeParse(env);
  if (!resultado.success) {
    // Só nomes de variáveis e motivos: nunca os valores (podem ser segredos).
    throw new ErroDeConfiguracao(
      resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    );
  }
  return resultado.data;
}
