import { defineConfig } from "drizzle-kit";
import { lerDatabaseUrl } from "./src/env.ts";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dbCredentials: { url: lerDatabaseUrl() },
  strict: true,
  verbose: true,
});
