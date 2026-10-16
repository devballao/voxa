import { describe, expect, it } from "vitest";
import { Snowflake } from "./ids.ts";

describe("Snowflake", () => {
  it("aceita IDs como string, inclusive acima de 2⁵³", () => {
    expect(Snowflake.parse("0")).toBe("0");
    expect(Snowflake.parse("9007199254740993")).toBe("9007199254740993");
    expect(Snowflake.parse("9223372036854775807")).toBe("9223372036854775807");
  });

  it.each([
    ["número", 123],
    ["vazio", ""],
    ["negativo", "-1"],
    ["com letras", "12a"],
    ["acima do bigint do Postgres", "9223372036854775808"],
    ["com 20 dígitos", "10000000000000000000"],
  ])("rejeita %s", (_, valor) => {
    expect(Snowflake.safeParse(valor).success).toBe(false);
  });
});
