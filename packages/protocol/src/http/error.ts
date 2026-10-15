import { z } from "zod";

/**
 * Códigos de erro estáveis da API. O cliente decide o que fazer pelo `code`;
 * `message` é só para humanos e pode mudar.
 */
export const ErrorCode = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHORIZED",
  "MISSING_PERMISSION",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

/** Formato único de erro da API (docs/04-backend.md §4.5). */
export const ErrorResponse = z.object({
  error: z.object({
    code: ErrorCode,
    message: z.string().min(1),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorResponse = z.infer<typeof ErrorResponse>;
