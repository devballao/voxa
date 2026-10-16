/**
 * Códigos de fechamento do WebSocket usados pelo gateway (faixa 4000–4999,
 * reservada para aplicações). O cliente decide se reconecta pelo código.
 */
export const GatewayCloseCode = {
  /** JSON inválido, mensagem fora do protocolo ou op não suportado. Não reconectar sem corrigir o cliente. */
  INVALID_MESSAGE: 4001,
  /** Nenhum HEARTBEAT recebido a tempo. Pode reconectar. */
  SESSION_TIMEOUT: 4009,
} as const;
export type GatewayCloseCode = (typeof GatewayCloseCode)[keyof typeof GatewayCloseCode];
