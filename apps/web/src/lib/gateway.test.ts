import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  criarClienteGateway,
  type EstadoGateway,
  esperaComBackoff,
  type SocketLike,
  urlPadraoGateway,
} from "./gateway.ts";

/** WebSocket falso controlado pelo teste. */
class SocketFalso implements SocketLike {
  readyState = 0;
  enviados: unknown[] = [];
  fechadoCom: number | undefined;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code: number; reason: string }) => void) | null = null;
  send(d: string) {
    this.enviados.push(JSON.parse(d));
  }
  close(codigo = 1000, motivo = "") {
    this.fechadoCom = codigo;
    this.servidorFecha(codigo, motivo);
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.();
  }
  receber(m: unknown) {
    this.onmessage?.({ data: typeof m === "string" ? m : JSON.stringify(m) });
  }
  servidorFecha(codigo: number, motivo = "") {
    this.readyState = 3;
    this.onclose?.({ code: codigo, reason: motivo });
  }
}

let sockets: SocketFalso[];
let estados: EstadoGateway[];
const ultimo = () => estados.at(-1) as EstadoGateway;
const atual = () => sockets.at(-1) as SocketFalso;

function iniciar() {
  return criarClienteGateway({
    url: "ws://teste/gateway",
    criarSocket: () => {
      const s = new SocketFalso();
      sockets.push(s);
      return s;
    },
    aoMudar: (e) => estados.push(e),
    esperaReconexao: (t) => t * 100,
    agora: () => 1_000,
  });
}

function conectarComHello(intervalo = 1000) {
  atual().abrir();
  atual().receber({ op: "HELLO", d: { heartbeat_interval: intervalo } });
}

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  estados = [];
});
afterEach(() => vi.useRealTimers());

describe("cliente do gateway", () => {
  it("após o HELLO envia HEARTBEAT na hora e depois a cada intervalo", () => {
    iniciar();
    conectarComHello(1000);
    expect(ultimo()).toMatchObject({
      conexao: "conectado",
      hello: true,
      heartbeatIntervalMs: 1000,
    });
    expect(atual().enviados).toEqual([{ op: "HEARTBEAT", d: null }]);

    atual().receber({ op: "HEARTBEAT_ACK", d: null });
    expect(ultimo()).toMatchObject({ acksRecebidos: 1, ultimoAckEm: 1_000 });

    vi.advanceTimersByTime(1000);
    expect(atual().enviados).toHaveLength(2);
  });

  it("HEARTBEAT envia a última sequência recebida em DISPATCH", () => {
    iniciar();
    conectarComHello(1000);
    atual().receber({ op: "HEARTBEAT_ACK", d: null });
    atual().receber({ op: "DISPATCH", t: "DEV_PING", s: 7, d: { message: "oi" } });
    expect(ultimo().ultimoEvento).toEqual({ t: "DEV_PING", s: 7, d: { message: "oi" }, em: 1_000 });

    vi.advanceTimersByTime(1000);
    expect(atual().enviados.at(-1)).toEqual({ op: "HEARTBEAT", d: 7 });
  });

  it("HEARTBEAT sem ACK até o próximo envio: fecha e reconecta", () => {
    iniciar();
    conectarComHello(1000);
    vi.advanceTimersByTime(1000); // nenhum ACK chegou
    expect(sockets[0]?.fechadoCom).toBe(4000);
    expect(ultimo()).toMatchObject({ conexao: "reconectando", tentativas: 1 });

    vi.advanceTimersByTime(100);
    expect(sockets).toHaveLength(2);
  });

  it("reconecta com espera crescente e zera as tentativas após um HELLO", () => {
    iniciar();
    atual().servidorFecha(1006);
    expect(ultimo().tentativas).toBe(1);
    vi.advanceTimersByTime(100);
    atual().servidorFecha(1006);
    expect(ultimo().tentativas).toBe(2);
    vi.advanceTimersByTime(199);
    expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(3);

    conectarComHello();
    expect(ultimo().tentativas).toBe(0);
  });

  it("RECONNECT do servidor: fecha e reconecta", () => {
    iniciar();
    conectarComHello();
    atual().receber({ op: "RECONNECT", d: null });
    expect(ultimo()).toMatchObject({ conexao: "reconectando", hello: false });
  });

  it("fechamento 4001 (mensagem inválida) não reconecta em laço", () => {
    iniciar();
    conectarComHello();
    atual().servidorFecha(4001, "mensagem inválida");
    expect(ultimo()).toMatchObject({
      conexao: "parado",
      ultimoFechamento: { codigo: 4001, motivo: "mensagem inválida" },
    });
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it("ignora mensagens que não são JSON ou fora do protocolo", () => {
    iniciar();
    conectarComHello();
    const antes = estados.length;
    atual().receber("{quebrado");
    atual().receber({ op: "QUALQUER", d: 1 });
    atual().onmessage?.({ data: new ArrayBuffer(2) });
    expect(estados.length).toBe(antes);
  });

  it("parar() fecha a conexão e não reconecta", () => {
    const c = iniciar();
    conectarComHello();
    c.parar();
    expect(ultimo().conexao).toBe("parado");
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });

  it("parar() durante a espera de reconexão cancela a nova tentativa", () => {
    const c = iniciar();
    atual().servidorFecha(1006);
    c.parar();
    expect(ultimo().conexao).toBe("parado");
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1);
  });
});

describe("utilitários", () => {
  it("urlPadraoGateway segue o protocolo da página", () => {
    expect(urlPadraoGateway({ protocol: "http:", host: "localhost:5173" })).toBe(
      "ws://localhost:5173/gateway?v=1&encoding=json",
    );
    expect(urlPadraoGateway({ protocol: "https:", host: "voxa.exemplo.org" })).toBe(
      "wss://voxa.exemplo.org/gateway?v=1&encoding=json",
    );
  });

  it("esperaComBackoff dobra até 30 s, com ±20%", () => {
    expect(esperaComBackoff(1, () => 0.5)).toBe(1000);
    expect(esperaComBackoff(3, () => 0.5)).toBe(4000);
    expect(esperaComBackoff(20, () => 0.5)).toBe(30_000);
    expect(esperaComBackoff(1, () => 0)).toBe(800);
    expect(esperaComBackoff(1, () => 1)).toBe(1200);
  });
});
