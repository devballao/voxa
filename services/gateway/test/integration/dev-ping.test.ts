import type { AddressInfo } from "node:net";
import { integracaoDisponivel } from "@voxa/config/vitest";
import { Valkey } from "iovalkey";
import { pino } from "pino";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { type Config, carregarConfig } from "../../src/config.ts";
import { ligarDevPing } from "../../src/dev-ping.ts";
import { criarGateway, type Gateway } from "../../src/gateway.ts";

function configDeDesenvolvimento(): Config | undefined {
  try {
    return carregarConfig();
  } catch {
    return undefined;
  }
}

const config = configDeDesenvolvimento();
const rodar = integracaoDisponivel(
  config !== undefined,
  "Rode `pnpm dev:infra` e `cp .env.example .env` na raiz.",
);

describe.skipIf(!rodar)("dev:ping: Valkey → gateway → cliente (requer pnpm dev:infra)", () => {
  let gateway: Gateway;
  let assinante: Valkey;
  let publicador: Valkey;
  const canal = `dev:ping`;

  beforeAll(async () => {
    const c = config as Config;
    assinante = new Valkey(c.VALKEY_URL);
    publicador = new Valkey(c.VALKEY_URL);
    gateway = criarGateway({ heartbeatIntervalMs: 5000, logger: pino({ level: "silent" }) });
    await ligarDevPing(assinante, gateway, pino({ level: "silent" }));
    await new Promise<void>((r) => gateway.server.listen(0, "127.0.0.1", r));
  });

  afterAll(async () => {
    await gateway?.close();
    await Promise.allSettled([assinante?.quit(), publicador?.quit()]);
  });

  it("PUBLISH no Valkey chega ao cliente WebSocket como DISPATCH DEV_PING", async () => {
    const { port } = gateway.server.address() as AddressInfo;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/gateway`);
    const mensagens: unknown[] = [];
    const recebeuPing = new Promise<void>((resolver) =>
      ws.on("message", (m) => {
        const msg = JSON.parse(m.toString());
        mensagens.push(msg);
        if (msg.op === "HELLO") void publicador.publish(canal, "oi do teste");
        if (msg.op === "DISPATCH") resolver();
      }),
    );
    await recebeuPing;
    ws.close();

    expect(mensagens[1]).toEqual({
      op: "DISPATCH",
      t: "DEV_PING",
      s: 1,
      d: { message: "oi do teste" },
    });
  });
});
