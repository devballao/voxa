import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Metadados da instância (chave → valor). A migração inicial grava
 * `schema_version`. Também serve para validar o fluxo de migrações.
 */
export const voxaMeta = pgTable("_voxa_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
