import { describe, expect, it } from "vitest";
import { lerDatabaseUrl } from "./env.ts";

describe("lerDatabaseUrl", () => {
  it("devolve DATABASE_URL do ambiente informado", () => {
    expect(lerDatabaseUrl({ DATABASE_URL: "postgres://u:s@h:5432/b" })).toBe(
      "postgres://u:s@h:5432/b",
    );
  });

  it("explica como resolver quando DATABASE_URL não existe", () => {
    expect(() => lerDatabaseUrl({})).toThrow(/DATABASE_URL não definida.*cp \.env\.example \.env/);
  });

  it("trata valor vazio como ausente", () => {
    expect(() => lerDatabaseUrl({ DATABASE_URL: "" })).toThrow(/DATABASE_URL não definida/);
  });
});
