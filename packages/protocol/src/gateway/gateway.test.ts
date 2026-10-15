import { describe, expect, it } from "vitest";
import { GatewayEnvelope } from "./envelope.ts";
import { ClientMessage, HelloMessage, ServerMessage } from "./messages.ts";

describe("GatewayEnvelope", () => {
  it("aceita um DISPATCH com evento e sequência", () => {
    const quadro = { op: "DISPATCH", t: "MESSAGE_CREATE", s: 42, d: { id: "1" } };
    expect(GatewayEnvelope.parse(quadro)).toEqual(quadro);
  });

  it("rejeita op desconhecido e sequência negativa ou fracionária", () => {
    expect(GatewayEnvelope.safeParse({ op: "PING", d: null }).success).toBe(false);
    expect(GatewayEnvelope.safeParse({ op: "DISPATCH", s: -1, d: null }).success).toBe(false);
    expect(GatewayEnvelope.safeParse({ op: "DISPATCH", s: 1.5, d: null }).success).toBe(false);
  });
});

describe("mensagens do gateway", () => {
  it("HELLO exige heartbeat_interval inteiro e positivo", () => {
    expect(HelloMessage.parse({ op: "HELLO", d: { heartbeat_interval: 41250 } }).d).toEqual({
      heartbeat_interval: 41250,
    });
    expect(HelloMessage.safeParse({ op: "HELLO", d: { heartbeat_interval: 0 } }).success).toBe(
      false,
    );
  });

  it("ServerMessage distingue HELLO de HEARTBEAT_ACK pelo op", () => {
    const ack = ServerMessage.parse({ op: "HEARTBEAT_ACK", d: null });
    expect(ack.op).toBe("HEARTBEAT_ACK");
    expect(ServerMessage.safeParse({ op: "HEARTBEAT", d: 1 }).success).toBe(false);
  });

  it("ClientMessage aceita HEARTBEAT com a última sequência ou null", () => {
    expect(ClientMessage.parse({ op: "HEARTBEAT", d: 7 })).toEqual({ op: "HEARTBEAT", d: 7 });
    expect(ClientMessage.parse({ op: "HEARTBEAT", d: null })).toEqual({
      op: "HEARTBEAT",
      d: null,
    });
  });

  it("ignora campos desconhecidos (compatibilidade com versões futuras)", () => {
    const hello = HelloMessage.parse({
      op: "HELLO",
      d: { heartbeat_interval: 1000, campo_novo: true },
      extra: 1,
    });
    expect(hello).toEqual({ op: "HELLO", d: { heartbeat_interval: 1000 } });
  });
});
