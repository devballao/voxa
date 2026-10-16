import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import { GATEWAY_PATH, GATEWAY_VERSION } from "@voxa/protocol";
import {
  ClientMessage,
  GatewayCloseCode,
  type GatewayEnvelope,
  type ServerMessage,
} from "@voxa/protocol/gateway";
import type { ErrorResponse, HealthCheck } from "@voxa/protocol/http";
import type { Logger } from "pino";
import { type WebSocket, WebSocketServer } from "ws";

/** Tamanho máximo de uma mensagem do cliente. HEARTBEAT tem poucos bytes. */
export const TAMANHO_MAXIMO_MENSAGEM = 4096;

/** Tolerância sobre o intervalo de HEARTBEAT antes de considerar a sessão expirada. */
export const FATOR_TOLERANCIA_HEARTBEAT = 1.5;

export interface SaudeGateway {
  status: "ok" | "error";
  connections: number;
  checks: Record<string, HealthCheck>;
}

export interface OpcoesGateway {
  heartbeatIntervalMs: number;
  logger: Logger;
  /** Verificações das dependências para o GET /health (ex.: Valkey). */
  verificarSaude?: () => Promise<Record<string, HealthCheck>>;
}

export interface Gateway {
  server: Server;
  /** Envia um evento (DISPATCH) a todas as conexões abertas. */
  broadcast(t: string, d: unknown): void;
  /** Quantidade de conexões abertas. */
  readonly conexoes: number;
  /** Avisa os clientes (RECONNECT), fecha as conexões e para de aceitar novas. */
  close(): Promise<void>;
}

interface Sessao {
  socket: WebSocket;
  /** Último número de sequência enviado em DISPATCH. */
  seq: number;
  expiracao: NodeJS.Timeout;
}

export function criarGateway(opcoes: OpcoesGateway): Gateway {
  const { heartbeatIntervalMs, logger } = opcoes;
  const limiteHeartbeatMs = Math.round(heartbeatIntervalMs * FATOR_TOLERANCIA_HEARTBEAT);
  const sessoes = new Set<Sessao>();
  const wss = new WebSocketServer({ noServer: true, maxPayload: TAMANHO_MAXIMO_MENSAGEM });

  const enviar = (socket: WebSocket, mensagem: ServerMessage | GatewayEnvelope) => {
    if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(mensagem));
  };

  const agendarExpiracao = (sessao: Sessao) => {
    clearTimeout(sessao.expiracao);
    sessao.expiracao = setTimeout(() => {
      logger.debug("sessão sem HEARTBEAT: encerrando");
      sessao.socket.close(GatewayCloseCode.SESSION_TIMEOUT, "heartbeat não recebido");
    }, limiteHeartbeatMs);
  };

  wss.on("connection", (socket) => {
    const sessao: Sessao = { socket, seq: 0, expiracao: setTimeout(() => {}, 0) };
    sessoes.add(sessao);
    agendarExpiracao(sessao);
    enviar(socket, { op: "HELLO", d: { heartbeat_interval: heartbeatIntervalMs } });
    logger.debug({ conexoes: sessoes.size }, "conexão aberta");

    socket.on("message", (dados, binario) => {
      const mensagem = binario ? undefined : interpretar(dados.toString());
      if (!mensagem) {
        socket.close(GatewayCloseCode.INVALID_MESSAGE, "mensagem inválida");
        return;
      }
      switch (mensagem.op) {
        case "HEARTBEAT":
          agendarExpiracao(sessao);
          enviar(socket, { op: "HEARTBEAT_ACK", d: null });
          break;
      }
    });

    socket.on("close", (codigo) => {
      clearTimeout(sessao.expiracao);
      sessoes.delete(sessao);
      logger.debug({ codigo, conexoes: sessoes.size }, "conexão fechada");
    });

    // Erros de protocolo (ex.: mensagem acima de maxPayload) chegam aqui; o `ws` fecha a conexão.
    socket.on("error", (erro) => logger.debug({ motivo: erro.message }, "erro na conexão"));
  });

  const server = createServer((req, res) => {
    void atenderHttp(req, res, opcoes, () => sessoes.size);
  });

  server.on("upgrade", (req: IncomingMessage, socket: Duplex, cabeca: Buffer) => {
    const url = new URL(req.url ?? "/", "http://gateway");
    const versao = url.searchParams.get("v");
    if (url.pathname !== GATEWAY_PATH) {
      return recusarUpgrade(socket, 404, "Not Found");
    }
    if (versao !== null && versao !== String(GATEWAY_VERSION)) {
      return recusarUpgrade(socket, 400, `Versão do gateway não suportada: v=${versao}`);
    }
    wss.handleUpgrade(req, socket, cabeca, (ws) => wss.emit("connection", ws, req));
  });

  return {
    server,
    broadcast(t, d) {
      for (const sessao of sessoes) {
        sessao.seq += 1;
        enviar(sessao.socket, { op: "DISPATCH", t, s: sessao.seq, d });
      }
    },
    get conexoes() {
      return sessoes.size;
    },
    async close() {
      for (const sessao of sessoes) {
        enviar(sessao.socket, { op: "RECONNECT", d: null });
        sessao.socket.close(1001, "servidor reiniciando");
      }
      await new Promise<void>((resolver) => wss.close(() => resolver()));
      await new Promise<void>((resolver) => {
        server.close(() => resolver());
        server.closeAllConnections();
      });
    },
  };
}

/** Valida a mensagem do cliente; `undefined` se não for JSON ou não seguir o protocolo. */
function interpretar(texto: string): ClientMessage | undefined {
  try {
    const resultado = ClientMessage.safeParse(JSON.parse(texto));
    return resultado.success ? resultado.data : undefined;
  } catch {
    return undefined;
  }
}

function recusarUpgrade(socket: Duplex, status: number, motivo: string) {
  socket.write(`HTTP/1.1 ${status} ${motivo}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
  socket.destroy();
}

async function atenderHttp(
  req: IncomingMessage,
  res: ServerResponse,
  opcoes: OpcoesGateway,
  conexoes: () => number,
) {
  const caminho = new URL(req.url ?? "/", "http://gateway").pathname;
  if (req.method === "GET" && caminho === "/health") {
    const checks = (await opcoes.verificarSaude?.()) ?? {};
    const saudavel = Object.values(checks).every((c) => c.status === "ok");
    const corpo: SaudeGateway = {
      status: saudavel ? "ok" : "error",
      connections: conexoes(),
      checks,
    };
    return responderJson(res, saudavel ? 200 : 503, corpo);
  }
  const erro: ErrorResponse = {
    error: { code: "NOT_FOUND", message: `Rota não encontrada: ${req.method} ${caminho}` },
  };
  return responderJson(res, 404, erro);
}

function responderJson(res: ServerResponse, status: number, corpo: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(corpo));
}
