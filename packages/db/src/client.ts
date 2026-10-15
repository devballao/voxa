import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { lerDatabaseUrl } from "./env.ts";
import * as schema from "./schema/index.ts";

export type Database = PostgresJsDatabase<typeof schema>;

export interface OpcoesDb {
  /** URL do Postgres. Padrão: `DATABASE_URL`. */
  url?: string;
  /** Conexões máximas no pool. Padrão: 10. */
  max?: number;
  /** Segundos até fechar conexões ociosas. Padrão: 30. */
  idleTimeout?: number;
  /** Segundos de espera para conectar. Padrão: 10. */
  connectTimeout?: number;
}

export interface ConexaoDb {
  db: Database;
  /** Cliente `postgres` subjacente, para SQL bruto quando necessário. */
  sql: postgres.Sql;
  /** Encerra o pool, esperando até `timeoutS` segundos pelas consultas em andamento. */
  close(timeoutS?: number): Promise<void>;
}

/** Cria a conexão com o banco (com pool). Chame `close()` no encerramento do processo. */
export function createDb(opcoes: OpcoesDb = {}): ConexaoDb {
  const sql = postgres(opcoes.url ?? lerDatabaseUrl(), {
    max: opcoes.max ?? 10,
    idle_timeout: opcoes.idleTimeout ?? 30,
    connect_timeout: opcoes.connectTimeout ?? 10,
    onnotice: () => {},
  });
  return {
    db: drizzle(sql, { schema }),
    sql,
    close: (timeoutS = 5) => sql.end({ timeout: timeoutS }),
  };
}
