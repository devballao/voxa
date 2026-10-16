import { GATEWAY_PATH, GATEWAY_VERSION } from "@voxa/protocol";
import { GatewayCloseCode, GatewayEnvelope, ServerMessage } from "@voxa/protocol/gateway";

export type EstadoConexao = "conectando" | "conectado" | "reconectando" | "parado";

export interface EventoRecebido {
  t: string;
  s: number;
  d: unknown;
  em: number;
}

export interface EstadoGateway {
  conexao: EstadoConexao;
  /** Recebeu HELLO nesta conexão. */
  hello: boolean;
  heartbeatIntervalMs: number | null;
  heartbeatsEnviados: number;
  acksRecebidos: number;
  /** Instante do último HEARTBEAT_ACK (ms desde a época). */
  ultimoAckEm: number | null;
  ultimoEvento: EventoRecebido | null;
  ultimoFechamento: { codigo: number; motivo: string } | null;
  /** Tentativas de reconexão desde a última conexão bem-sucedida. */
  tentativas: number;
}

export const ESTADO_INICIAL: EstadoGateway = {
  conexao: "conectando",
  hello: false,
  heartbeatIntervalMs: null,
  heartbeatsEnviados: 0,
  acksRecebidos: 0,
  ultimoAckEm: null,
  ultimoEvento: null,
  ultimoFechamento: null,
  tentativas: 0,
};

/** Subconjunto do WebSocket usado pelo cliente (permite um falso nos testes). */
export interface SocketLike {
  readonly readyState: number;
  send(dados: string): void;
  close(codigo?: number, motivo?: string): void;
  onopen: (() => void) | null;
  onmessage: ((evento: { data: unknown }) => void) | null;
  onclose: ((evento: { code: number; reason: string }) => void) | null;
}

export interface OpcoesClienteGateway {
  url?: string;
  criarSocket?: (url: string) => SocketLike;
  aoMudar: (estado: EstadoGateway) => void;
  /** Espera antes da próxima tentativa (ms). Padrão: 1 s, 2 s, 4 s… até 30 s, com jitter. */
  esperaReconexao?: (tentativa: number) => number;
  agora?: () => number;
}

export interface ClienteGateway {
  /** Para o cliente: fecha a conexão e não reconecta. */
  parar(): void;
}

const ABERTO = 1;

/** URL do gateway: relativa à página (o Vite faz o proxy em dev) ou VITE_GATEWAY_URL. */
export function urlPadraoGateway(local: Pick<Location, "protocol" | "host"> = location): string {
  const configurada = import.meta.env.VITE_GATEWAY_URL;
  if (configurada) return configurada;
  const esquema = local.protocol === "https:" ? "wss" : "ws";
  return `${esquema}://${local.host}${GATEWAY_PATH}?v=${GATEWAY_VERSION}&encoding=json`;
}

export function esperaComBackoff(tentativa: number, aleatorio = Math.random): number {
  const base = Math.min(30_000, 1000 * 2 ** Math.max(0, tentativa - 1));
  return Math.round(base * (0.8 + aleatorio() * 0.4)); // ±20% para não reconectar todos juntos
}

/**
 * Cliente do gateway (docs/04-backend.md §4.6): envia HEARTBEAT logo após o HELLO
 * e depois a cada intervalo; se um HEARTBEAT ficar sem ACK até o próximo envio,
 * considera a conexão morta e reconecta. Reconecta com backoff exponencial.
 */
export function criarClienteGateway(opcoes: OpcoesClienteGateway): ClienteGateway {
  const url = opcoes.url ?? urlPadraoGateway();
  const criarSocket =
    opcoes.criarSocket ?? ((u: string) => new WebSocket(u) as unknown as SocketLike);
  const esperaReconexao = opcoes.esperaReconexao ?? ((t: number) => esperaComBackoff(t));
  const agora = opcoes.agora ?? Date.now;

  let estado: EstadoGateway = { ...ESTADO_INICIAL };
  let socket: SocketLike | null = null;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let reconexao: ReturnType<typeof setTimeout> | undefined;
  let aguardandoAck = false;
  let ultimaSeq: number | null = null;
  let parado = false;

  const atualizar = (parcial: Partial<EstadoGateway>) => {
    estado = { ...estado, ...parcial };
    opcoes.aoMudar(estado);
  };

  const enviarHeartbeat = () => {
    if (!socket || socket.readyState !== ABERTO) return;
    if (aguardandoAck) {
      // O último HEARTBEAT não teve resposta: conexão "zumbi". Reconecta.
      socket.close(4000, "heartbeat sem resposta");
      return;
    }
    aguardandoAck = true;
    socket.send(JSON.stringify({ op: "HEARTBEAT", d: ultimaSeq }));
    atualizar({ heartbeatsEnviados: estado.heartbeatsEnviados + 1 });
  };

  const tratarMensagem = (texto: string) => {
    let bruto: unknown;
    try {
      bruto = JSON.parse(texto);
    } catch {
      return;
    }
    const conhecida = ServerMessage.safeParse(bruto);
    if (conhecida.success) {
      const msg = conhecida.data;
      if (msg.op === "HELLO") {
        aguardandoAck = false;
        clearInterval(heartbeat);
        heartbeat = setInterval(enviarHeartbeat, msg.d.heartbeat_interval);
        atualizar({
          conexao: "conectado",
          hello: true,
          heartbeatIntervalMs: msg.d.heartbeat_interval,
          tentativas: 0,
        });
        enviarHeartbeat();
      } else if (msg.op === "HEARTBEAT_ACK") {
        aguardandoAck = false;
        atualizar({ acksRecebidos: estado.acksRecebidos + 1, ultimoAckEm: agora() });
      } else if (msg.op === "RECONNECT") {
        socket?.close(4000, "servidor pediu reconexão");
      }
      return;
    }
    const envelope = GatewayEnvelope.safeParse(bruto);
    if (
      envelope.success &&
      envelope.data.op === "DISPATCH" &&
      envelope.data.t &&
      envelope.data.s !== undefined
    ) {
      ultimaSeq = envelope.data.s;
      atualizar({
        ultimoEvento: { t: envelope.data.t, s: envelope.data.s, d: envelope.data.d, em: agora() },
      });
    }
  };

  const conectar = () => {
    aguardandoAck = false;
    ultimaSeq = null;
    const s = criarSocket(url);
    socket = s;
    s.onmessage = (evento) => {
      if (typeof evento.data === "string") tratarMensagem(evento.data);
    };
    s.onclose = (evento) => {
      clearInterval(heartbeat);
      if (socket !== s) return;
      socket = null;
      const fechamento = { codigo: evento.code, motivo: evento.reason };
      if (parado) {
        atualizar({ conexao: "parado", hello: false, ultimoFechamento: fechamento });
        return;
      }
      if (evento.code === GatewayCloseCode.INVALID_MESSAGE) {
        // Erro do próprio cliente: reconectar em laço não resolveria.
        atualizar({ conexao: "parado", hello: false, ultimoFechamento: fechamento });
        return;
      }
      const tentativas = estado.tentativas + 1;
      atualizar({
        conexao: "reconectando",
        hello: false,
        ultimoFechamento: fechamento,
        tentativas,
      });
      reconexao = setTimeout(conectar, esperaReconexao(tentativas));
    };
  };

  conectar();
  return {
    parar() {
      parado = true;
      clearTimeout(reconexao);
      clearInterval(heartbeat);
      if (socket) socket.close(1000, "cliente encerrado");
      else atualizar({ conexao: "parado", hello: false });
    },
  };
}
