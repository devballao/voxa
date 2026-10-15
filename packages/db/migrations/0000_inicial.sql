CREATE TABLE "_voxa_meta" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Escrito à mão: registra a versão do esquema (não é gerado pelo drizzle-kit).
INSERT INTO "_voxa_meta" ("key", "value") VALUES ('schema_version', '1') ON CONFLICT ("key") DO NOTHING;
