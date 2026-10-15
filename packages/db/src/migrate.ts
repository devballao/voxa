import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import type { Database } from "./client.ts";

/** Pasta das migrações versionadas (funciona a partir de src/ e de dist/). */
export const PASTA_MIGRACOES = fileURLToPath(new URL("../migrations", import.meta.url));

/**
 * Aplica as migrações pendentes. Idempotente: migrações já aplicadas
 * (registradas em `drizzle.__drizzle_migrations`) são puladas.
 */
export async function aplicarMigracoes(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder: PASTA_MIGRACOES });
}
