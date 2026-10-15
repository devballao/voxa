// pnpm db:migrate — aplica as migrações pendentes no banco de DATABASE_URL.
// Roda direto com o Node 24 (remoção de tipos nativa), sem build.
import { createDb } from "../client.ts";
import { aplicarMigracoes } from "../migrate.ts";

const conexao = createDb({ max: 1 });
try {
  const antes = await contarAplicadas();
  await aplicarMigracoes(conexao.db);
  const depois = await contarAplicadas();
  const novas = depois - antes;
  console.log(
    novas > 0
      ? `✓ ${novas} migração(ões) aplicada(s). Total: ${depois}.`
      : `✓ Banco já está atualizado (${depois} migração(ões) aplicada(s)).`,
  );
} catch (erro) {
  console.error("✗ Falha ao aplicar migrações:", erro instanceof Error ? erro.message : erro);
  process.exitCode = 1;
} finally {
  await conexao.close();
}

async function contarAplicadas(): Promise<number> {
  const [linha] = await conexao.sql<{ total: number }[]>`
    select count(*)::int as total from information_schema.tables
    where table_schema = 'drizzle' and table_name = '__drizzle_migrations'`;
  if (!linha?.total) return 0;
  const [r] = await conexao.sql<{ total: number }[]>`
    select count(*)::int as total from drizzle.__drizzle_migrations`;
  return r?.total ?? 0;
}
