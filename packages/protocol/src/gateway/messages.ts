import { z } from "zod";

/** Primeira mensagem do servidor após a conexão. */
export const HelloMessage = z.object({
  op: z.literal("HELLO"),
  d: z.object({
    /** Intervalo, em ms, em que o cliente deve enviar HEARTBEAT. */
    heartbeat_interval: z.int().positive(),
  }),
});
export type HelloMessage = z.infer<typeof HelloMessage>;

/** Enviado pelo cliente; `d` é o último `s` recebido (ou `null`). */
export const HeartbeatMessage = z.object({
  op: z.literal("HEARTBEAT"),
  d: z.int().nonnegative().nullable(),
});
export type HeartbeatMessage = z.infer<typeof HeartbeatMessage>;

/** Resposta do servidor a cada HEARTBEAT. */
export const HeartbeatAckMessage = z.object({
  op: z.literal("HEARTBEAT_ACK"),
  d: z.null(),
});
export type HeartbeatAckMessage = z.infer<typeof HeartbeatAckMessage>;

/** Mensagens que o servidor envia (cresce a cada marco). */
export const ServerMessage = z.discriminatedUnion("op", [HelloMessage, HeartbeatAckMessage]);
export type ServerMessage = z.infer<typeof ServerMessage>;

/** Mensagens que o cliente envia (cresce a cada marco). */
export const ClientMessage = z.discriminatedUnion("op", [HeartbeatMessage]);
export type ClientMessage = z.infer<typeof ClientMessage>;
