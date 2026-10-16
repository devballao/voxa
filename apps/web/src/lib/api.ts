import { API_BASE_PATH } from "@voxa/protocol";
import { HealthResponse } from "@voxa/protocol/http";

/** Resultado da consulta ao `GET /api/v1/health`. */
export type ResultadoSaude =
  | { tipo: "resposta"; http: number; saude: HealthResponse }
  | { tipo: "inacessivel"; motivo: string };

/** Base da API. Em dev é relativa (o Vite faz o proxy); pode ser trocada por VITE_API_URL. */
export const BASE_API = import.meta.env.VITE_API_URL ?? "";

/**
 * Consulta a saúde da API. Nunca lança erro: uma API fora do ar vira
 * `{ tipo: "inacessivel" }`, com o motivo para mostrar na tela.
 */
export async function lerSaude(
  fetcher: typeof fetch = fetch,
  sinal?: AbortSignal,
): Promise<ResultadoSaude> {
  let resposta: Response;
  try {
    resposta = await fetcher(`${BASE_API}${API_BASE_PATH}/health`, {
      signal: sinal ?? null,
      headers: { accept: "application/json" },
    });
  } catch {
    return { tipo: "inacessivel", motivo: "sem resposta da API (rede ou proxy)" };
  }
  try {
    const saude = HealthResponse.parse(await resposta.json());
    return { tipo: "resposta", http: resposta.status, saude };
  } catch {
    // 502/503/504 sem corpo da API: quem respondeu foi o proxy, e a API está fora do ar.
    const motivo = [502, 503, 504].includes(resposta.status)
      ? `API fora do ar (o proxy respondeu HTTP ${resposta.status})`
      : `resposta inesperada da API (HTTP ${resposta.status})`;
    return { tipo: "inacessivel", motivo };
  }
}
