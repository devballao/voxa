import type { Valkey } from "iovalkey";
import type { Logger } from "pino";
import type { Gateway } from "./gateway.ts";

/** Canal de desenvolvimento: tudo publicado nele vira um DISPATCH DEV_PING para todos os clientes. */
export const CANAL_DEV_PING = "dev:ping";

/**
 * Liga o canal `dev:ping` do Valkey ao gateway, para provar o caminho de eventos
 * (Valkey → gateway → clientes). Só para desenvolvimento: o main.ts não chama em produção.
 * `assinante` precisa ser uma conexão exclusiva (em modo SUBSCRIBE ela não executa outros comandos).
 */
export async function ligarDevPing(assinante: Valkey, gateway: Gateway, logger: Logger) {
  assinante.on("message", (canal, mensagem) => {
    if (canal !== CANAL_DEV_PING) return;
    logger.info({ conexoes: gateway.conexoes }, "dev:ping recebido: repassando aos clientes");
    gateway.broadcast("DEV_PING", { message: mensagem });
  });
  await assinante.subscribe(CANAL_DEV_PING);
}
