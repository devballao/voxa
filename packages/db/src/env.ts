import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** `.env` da raiz do monorepo (usado só em desenvolvimento). */
const envDaRaiz = fileURLToPath(new URL("../../../.env", import.meta.url));

/**
 * Lê `DATABASE_URL` do ambiente. Em desenvolvimento, carrega antes o `.env`
 * da raiz, se existir; variáveis já definidas no ambiente têm prioridade.
 */
export function lerDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env === process.env && env.DATABASE_URL === undefined && existsSync(envDaRaiz)) {
    process.loadEnvFile(envDaRaiz);
  }
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL não definida. Em desenvolvimento: cp .env.example .env (na raiz do repositório).",
    );
  }
  return url;
}
