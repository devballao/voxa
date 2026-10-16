import type { AddressInfo } from "node:net";
import { GatewayCloseCode } from "@voxa/protocol/gateway";
import { pino } from "pino";
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  criarGateway,
  type Gateway,
  type OpcoesGateway,
  TAMANHO_MAXIMO_MENSAGEM,
} from "./gateway.ts";

const silencioso = pino({ level: "silent" });
let gateway: Gateway | undefined;
let base = "";

afterEach(async () => {
  await gateway?.close();
  gateway = undefined;
});

async function iniciar(opcoes: Partial<OpcoesGateway> = {}) {
  gateway = criarGateway({ heartbeatIntervalMs: 5000, logger: silencioso, ...opcoes });
  await new Promise<void>((r) => gateway?.server.listen(0, "127.0.0.1", r));
  const { port } = gateway.server.address() as AddressInfo;
  base = `127.0.0.1:${port}`;
  return gateway;
}

/** Cliente de teste: guarda as mensagens recebidas e o código de fechamento. */
function conectar(caminho = "/gateway") {
  const ws = new WebSocket(`ws://${base}${caminho}`);
  const recebidas: unknown[] = [];
  const esperas: (() => void)[] = [];
  ws.on("message", (m) => {
    recebidas.push(JSON.parse(m.toString()));
    for (const e of esperas.splice(0)) e();
  });
  const fechado = new Promise<number>((r) => ws.on("close", (codigo) => r(codigo)));
  const mensagens = async (n: number) => {
    while (recebidas.length < n) await new Promise<void>((r) => esperas.push(r));
    return recebidas.slice(0, n);
  };
  return { ws, mensagens, fechado, aberto: new Promise((r, f) => ws.on("open", r).on("error", f)) };
}

describe("conexão e heartbeat", () => {
  it("envia HELLO ao conectar e responde HEARTBEAT com HEARTBEAT_ACK", async () => {
    await iniciar({ heartbeatIntervalMs: 41_250 });
    const c = conectar();
    expect(await c.mensagens(1)).toEqual([{ op: "HELLO", d: { heartbeat_interval: 41_250 } }]);

    c.ws.send(JSON.stringify({ op: "HEARTBEAT", d: null }));
    expect((await c.mensagens(2))[1]).toEqual({ op: "HEARTBEAT_ACK", d: null });
    c.ws.close();
  });

  it("aceita a versão explícita ?v=1", async () => {
    await iniciar();
    const c = conectar("/gateway?v=1&encoding=json");
    expect((await c.mensagens(1))[0]).toMatchObject({ op: "HELLO" });
    c.ws.close();
  });

  it("encerra com 4009 quando o cliente para de enviar HEARTBEAT", async () => {
    await iniciar({ heartbeatIntervalMs: 1000 });
    const inicio = Date.now();
    const c = conectar();
    expect(await c.fechado).toBe(GatewayCloseCode.SESSION_TIMEOUT);
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(1400); // intervalo × 1,5
  });

  it("HEARTBEAT renova o prazo da sessão", async () => {
    await iniciar({ heartbeatIntervalMs: 1000 });
    const c = conectar();
    await c.mensagens(1);
    for (let i = 0; i < 3; i++) {
      await new Promise((r) => setTimeout(r, 700));
      c.ws.send(JSON.stringify({ op: "HEARTBEAT", d: i }));
    }
    expect(c.ws.readyState).toBe(WebSocket.OPEN); // 2,1 s > 1,5 s de prazo sem renovação
    c.ws.close();
  });
});

describe("mensagens inválidas", () => {
  it.each([
    ["JSON inválido", "{nao é json"],
    ["op fora do protocolo", JSON.stringify({ op: "PING", d: null })],
    ["op do servidor enviado pelo cliente", JSON.stringify({ op: "HELLO", d: {} })],
  ])("%s → fecha com 4001", async (_nome, texto) => {
    await iniciar();
    const c = conectar();
    await c.mensagens(1);
    c.ws.send(texto);
    expect(await c.fechado).toBe(GatewayCloseCode.INVALID_MESSAGE);
  });

  it("mensagem binária → fecha com 4001", async () => {
    await iniciar();
    const c = conectar();
    await c.mensagens(1);
    c.ws.send(Buffer.from([1, 2, 3]));
    expect(await c.fechado).toBe(GatewayCloseCode.INVALID_MESSAGE);
  });

  it("mensagem acima do limite → fecha com 1009 (muito grande)", async () => {
    await iniciar();
    const c = conectar();
    await c.mensagens(1);
    c.ws.send("x".repeat(TAMANHO_MAXIMO_MENSAGEM + 1));
    expect(await c.fechado).toBe(1009);
  });
});

describe("upgrade", () => {
  it("recusa versão não suportada e caminho desconhecido", async () => {
    await iniciar();
    const versao = conectar("/gateway?v=2");
    await expect(versao.aberto).rejects.toThrow(/400/);
    const caminho = conectar("/outro");
    await expect(caminho.aberto).rejects.toThrow(/404/);
  });
});

describe("eventos", () => {
  it("broadcast envia DISPATCH com sequência própria de cada conexão", async () => {
    const g = await iniciar();
    const a = conectar();
    await a.mensagens(1);
    g.broadcast("DEV_PING", { message: "1" });
    const b = conectar();
    await Promise.all([a.mensagens(2), b.mensagens(1)]);
    g.broadcast("DEV_PING", { message: "2" });

    expect((await a.mensagens(3)).slice(1)).toEqual([
      { op: "DISPATCH", t: "DEV_PING", s: 1, d: { message: "1" } },
      { op: "DISPATCH", t: "DEV_PING", s: 2, d: { message: "2" } },
    ]);
    expect((await b.mensagens(2))[1]).toEqual({
      op: "DISPATCH",
      t: "DEV_PING",
      s: 1,
      d: { message: "2" },
    });
    expect(g.conexoes).toBe(2);
  });

  it("close() avisa com RECONNECT e fecha com 1001", async () => {
    const g = await iniciar();
    const c = conectar();
    await c.mensagens(1);
    await g.close();
    gateway = undefined;
    expect((await c.mensagens(2))[1]).toEqual({ op: "RECONNECT", d: null });
    expect(await c.fechado).toBe(1001);
  });
});

describe("HTTP", () => {
  it("GET /health: 200 com as verificações e o número de conexões", async () => {
    await iniciar({ verificarSaude: async () => ({ valkey: { status: "ok", latency_ms: 1 } }) });
    const c = conectar();
    await c.mensagens(1);
    const res = await fetch(`http://${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "ok",
      connections: 1,
      checks: { valkey: { status: "ok", latency_ms: 1 } },
    });
    c.ws.close();
  });

  it("GET /health: 503 quando uma dependência falha", async () => {
    await iniciar({
      verificarSaude: async () => ({
        valkey: { status: "error", latency_ms: 2, error: "ECONNREFUSED" },
      }),
    });
    const res = await fetch(`http://${base}/health`);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ status: "error" });
  });

  it("GET /health sem verificações configuradas: 200", async () => {
    await iniciar();
    expect((await fetch(`http://${base}/health`)).status).toBe(200);
  });

  it("outras rotas: 404 no formato de erro padrão", async () => {
    await iniciar();
    const res = await fetch(`http://${base}/xyz?token=segredo`);
    expect(res.status).toBe(404);
    const corpo = await res.json();
    expect(corpo).toEqual({
      error: { code: "NOT_FOUND", message: "Rota não encontrada: GET /xyz" },
    });
  });
});
