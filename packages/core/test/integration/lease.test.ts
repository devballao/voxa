import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { integracaoDisponivel } from "@voxa/config/vitest";
import { Valkey } from "iovalkey";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { chaveDoWorker, LeaseDeWorker } from "../../src/snowflake/lease.ts";

/** VALKEY_URL do ambiente ou do .env da raiz (em desenvolvimento). */
function urlDoValkey(): string | undefined {
  const env = fileURLToPath(new URL("../../../../.env", import.meta.url));
  if (process.env.VALKEY_URL === undefined && existsSync(env)) process.loadEnvFile(env);
  return process.env.VALKEY_URL;
}

const url = urlDoValkey();
const rodar = integracaoDisponivel(
  url !== undefined,
  "Rode `pnpm dev:infra` e `cp .env.example .env` na raiz.",
);

describe.skipIf(!rodar)("lease do worker com o Valkey real (requer pnpm dev:infra)", () => {
  let valkey: Valkey;
  let outro: Valkey;
  // Faixa alta e aleatória: não colide com os serviços de um `pnpm dev` rodando ao mesmo tempo.
  const inicio = 900 + Math.floor(Math.random() * 100);

  beforeAll(() => {
    valkey = new Valkey(url as string);
    outro = new Valkey(url as string);
  });

  afterAll(async () => {
    await Promise.allSettled([valkey?.quit(), outro?.quit()]);
  });

  it("dois processos recebem workers diferentes, e o lease é liberado ao encerrar", async () => {
    const a = new LeaseDeWorker({ valkey, dono: "teste-a", inicio });
    const b = new LeaseDeWorker({ valkey: outro, dono: "teste-b", inicio });
    await a.iniciar();
    await b.iniciar();

    expect(a.worker).toBeTypeOf("number");
    expect(b.worker).toBeTypeOf("number");
    expect(a.worker).not.toBe(b.worker);

    const chaveA = chaveDoWorker(a.worker as number);
    const chaveB = chaveDoWorker(b.worker as number);
    expect(await valkey.get(chaveA)).toMatch(/^teste-a:/);
    expect(await valkey.pttl(chaveA)).toBeGreaterThan(0);

    await a.liberar();
    await b.liberar();
    expect(a.worker).toBeUndefined();
    expect(await valkey.exists(chaveA, chaveB)).toBe(0);
  });

  it("não libera o lease que já pertence a outro processo", async () => {
    const a = new LeaseDeWorker({ valkey, dono: "teste-a", inicio });
    await a.iniciar();
    const chave = chaveDoWorker(a.worker as number);
    // Simula a expiração e outro processo assumindo o mesmo worker.
    await valkey.set(chave, "outro-processo:x", "PX", 30_000);
    await a.liberar();
    expect(await valkey.get(chave)).toBe("outro-processo:x");
    await valkey.del(chave);
  });

  it("ao perder o lease, reserva outro worker na renovação seguinte", async () => {
    const a = new LeaseDeWorker({
      valkey,
      dono: "teste-a",
      inicio,
      ttlMs: 1_000,
      intervaloMs: 100,
    });
    await a.iniciar();
    const primeiro = a.worker as number;
    await valkey.set(chaveDoWorker(primeiro), "outro-processo:x", "PX", 30_000);
    await new Promise((r) => setTimeout(r, 300));
    expect(a.worker).toBeTypeOf("number");
    expect(a.worker).not.toBe(primeiro);
    await a.liberar();
    await valkey.del(chaveDoWorker(primeiro));
  });
});
