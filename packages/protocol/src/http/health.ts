import { z } from "zod";

/** Dependências verificadas pelo `GET /api/v1/health`. */
export const HealthDependency = z.enum(["postgres", "valkey", "s3", "livekit"]);
export type HealthDependency = z.infer<typeof HealthDependency>;

export const HealthStatus = z.enum(["ok", "error"]);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const HealthCheck = z.object({
  status: HealthStatus,
  /** Tempo da verificação, em milissegundos. */
  latency_ms: z.number().nonnegative(),
  /** Motivo da falha, sem dados sensíveis (só quando `status` é `error`). */
  error: z.string().optional(),
});
export type HealthCheck = z.infer<typeof HealthCheck>;

/**
 * Resposta de `GET /api/v1/health`.
 * HTTP 200 quando todas as dependências estão `ok`; HTTP 503 caso contrário.
 */
export const HealthResponse = z.object({
  status: HealthStatus,
  version: z.string().min(1),
  uptime_s: z.number().nonnegative(),
  checks: z.record(HealthDependency, HealthCheck),
});
export type HealthResponse = z.infer<typeof HealthResponse>;
