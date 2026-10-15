import { z } from "zod";

/** Tipos de quadro do gateway (docs/04-backend.md §4.6). */
export const GatewayOp = z.enum([
  "HELLO",
  "IDENTIFY",
  "READY",
  "RESUME",
  "RESUMED",
  "HEARTBEAT",
  "HEARTBEAT_ACK",
  "DISPATCH",
  "PRESENCE_SET",
  "SUBSCRIBE",
  "RECONNECT",
  "INVALID_SESSION",
]);
export type GatewayOp = z.infer<typeof GatewayOp>;

/**
 * Envelope de toda mensagem do gateway.
 * - `t`: nome do evento, só em `DISPATCH`
 * - `s`: número de sequência, só em `DISPATCH` (usado para `RESUME`)
 */
export const GatewayEnvelope = z.object({
  op: GatewayOp,
  t: z.string().min(1).optional(),
  s: z.int().nonnegative().optional(),
  d: z.unknown(),
});
export type GatewayEnvelope = z.infer<typeof GatewayEnvelope>;
