import { z } from "zod";

/** Maior ID aceito: o `bigint` (com sinal) do Postgres. */
const MAX_SNOWFLAKE = 2n ** 63n - 1n;

/**
 * ID Snowflake no fio: **string** de dígitos, porque o JavaScript perde precisão
 * em números acima de 2⁵³ (docs/04-backend.md §4.2).
 */
export const Snowflake = z
  .string()
  .regex(/^\d{1,19}$/, "ID inválido")
  // O Zod roda o refine mesmo se o regex falhar: só converte quando são só dígitos.
  .refine((id) => !/^\d+$/.test(id) || BigInt(id) <= MAX_SNOWFLAKE, "ID inválido");
export type Snowflake = z.infer<typeof Snowflake>;
