import { randomBytes } from "node:crypto";
import { integracaoDisponivel } from "@voxa/config/vitest";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type ConexaoDb, createDb } from "../../src/client.ts";
import { lerDatabaseUrl } from "../../src/env.ts";
import { aplicarMigracoes } from "../../src/migrate.ts";
import { voxaMeta } from "../../src/schema/index.ts";

/** URL do banco de dev, se houver (.env da raiz ou ambiente). Sem ela, os testes são pulados. */
function urlDeDesenvolvimento(): string | undefined {
  try {
    return lerDatabaseUrl();
  } catch {
    return undefined;
  }
}

const urlBase = urlDeDesenvolvimento();

// Cada execução usa um banco descartável, criado e apagado aqui.
const rodar = integracaoDisponivel(
  urlBase !== undefined,
  "Rode `pnpm dev:infra` e `cp .env.example .env` na raiz.",
);

describe.skipIf(!rodar)("integração com PostgreSQL (requer pnpm dev:infra)", () => {
  const nomeBanco = `voxa_teste_${randomBytes(4).toString("hex")}`;
  let admin: postgres.Sql;
  let conexao: ConexaoDb;

  beforeAll(async () => {
    admin = postgres(urlBase as string, { max: 1, onnotice: () => {} });
    await admin.unsafe(`create database ${nomeBanco}`);
    const url = new URL(urlBase as string);
    url.pathname = `/${nomeBanco}`;
    conexao = createDb({ url: url.toString(), max: 2 });
  });

  afterAll(async () => {
    await conexao?.close();
    await admin?.unsafe(`drop database if exists ${nomeBanco} with (force)`);
    await admin?.end();
  });

  it("aplica as migrações num banco vazio e grava schema_version", async () => {
    await aplicarMigracoes(conexao.db);

    const linhas = await conexao.db
      .select({ value: voxaMeta.value })
      .from(voxaMeta)
      .where(eq(voxaMeta.key, "schema_version"));
    expect(linhas).toEqual([{ value: "1" }]);
  });

  it("é idempotente: aplicar de novo não altera nada", async () => {
    const contar = () =>
      conexao.sql<
        { total: number }[]
      >`select count(*)::int as total from drizzle.__drizzle_migrations`;
    const [antes] = await contar();
    await aplicarMigracoes(conexao.db);
    const [depois] = await contar();
    expect(depois?.total).toBe(antes?.total);
    expect(antes?.total).toBeGreaterThan(0);
  });

  it("close() encerra o pool: novas consultas falham", async () => {
    const temporaria = createDb({
      url: new URL(`/${nomeBanco}`, urlBase as string).toString(),
      max: 1,
    });
    await temporaria.sql`select 1`;
    await temporaria.close();
    await expect(temporaria.sql`select 1`).rejects.toThrow();
  });
});
