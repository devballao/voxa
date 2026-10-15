import { HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3";
import type { ConexaoDb } from "@voxa/db";
import type { HealthCheck, HealthDependency } from "@voxa/protocol/http";
import type { Valkey } from "iovalkey";
import type { RoomServiceClient } from "livekit-server-sdk";

/** Uma verificação: resolve se a dependência está saudável, lança erro caso contrário. */
export type Verificacao = (sinal: AbortSignal) => Promise<unknown>;

export type Verificacoes = Record<HealthDependency, Verificacao>;

/** Tempo máximo de cada verificação, em ms. */
export const TIMEOUT_VERIFICACAO_MS = 2000;

/** Executa uma verificação com tempo-limite e mede a latência. */
export async function executarVerificacao(
  verificacao: Verificacao,
  timeoutMs = TIMEOUT_VERIFICACAO_MS,
): Promise<HealthCheck> {
  const inicio = performance.now();
  const controle = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => {
      controle.abort();
      rejeitar(new Error(`timeout após ${timeoutMs} ms`));
    }, timeoutMs);
  });
  try {
    await Promise.race([verificacao(controle.signal), limite]);
    return { status: "ok", latency_ms: duracao(inicio) };
  } catch (erro) {
    return { status: "error", latency_ms: duracao(inicio), error: motivoSeguro(erro) };
  } finally {
    clearTimeout(timer);
  }
}

function duracao(inicio: number): number {
  return Math.round((performance.now() - inicio) * 10) / 10;
}

/**
 * Motivo curto e sem dados sensíveis: códigos de erro de rede (ECONNREFUSED…)
 * ou o nome do erro. Nunca a mensagem completa, que pode conter URLs e credenciais.
 */
export function motivoSeguro(erro: unknown): string {
  if (erro instanceof Error) {
    const codigo = (erro as { code?: unknown }).code;
    if (typeof codigo === "string" && /^[A-Z0-9_]+$/.test(codigo)) return codigo;
    if (erro.message.startsWith("timeout após")) return erro.message;
    return erro.name;
  }
  return "erro desconhecido";
}

export interface ClientesDasDependencias {
  db: ConexaoDb;
  valkey: Valkey;
  s3: S3Client;
  s3Bucket: string;
  livekit: RoomServiceClient;
}

/** Verificações reais, usando os clientes da aplicação. */
export function criarVerificacoes(c: ClientesDasDependencias): Verificacoes {
  return {
    postgres: () => c.db.sql`select 1`,
    valkey: () => c.valkey.ping(),
    s3: (sinal) => c.s3.send(new HeadBucketCommand({ Bucket: c.s3Bucket }), { abortSignal: sinal }),
    livekit: () => c.livekit.listRooms(),
  };
}
