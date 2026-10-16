import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const envDaRaiz = fileURLToPath(new URL("../../../.env", import.meta.url));

/** Variáveis de ambiente do gateway. Qualquer ausência ou erro impede a inicialização. */
const EsquemaEnv = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  GATEWAY_HOST: z.string().min(1).default("127.0.0.1"),
  GATEWAY_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Intervalo de HEARTBEAT pedido ao cliente, em ms. */
  GATEWAY_HEARTBEAT_INTERVAL_MS: z.coerce.number().int().min(1000).default(41_250),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  VALKEY_URL: z.url({ protocol: /^rediss?$/ }),
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
