import type { HealthCheck } from "@voxa/protocol/http";

/**
 * Executa uma verificação com tempo-limite e mede a latência. O motivo da falha
 * é só o código de erro (ex.: ECONNREFUSED) ou "timeout", nunca a mensagem
 * completa, que pode conter URLs e credenciais.
 */
export async function verificar(
  verificacao: () => Promise<unknown>,
  timeoutMs = 2000,
): Promise<HealthCheck> {
  const inicio = performance.now();
  let timer: NodeJS.Timeout | undefined;
  const limite = new Promise<never>((_, rejeitar) => {
    timer = setTimeout(() => rejeitar(new Error("timeout")), timeoutMs);
  });
  try {
    await Promise.race([verificacao(), limite]);
    return { status: "ok", latency_ms: Math.round(performance.now() - inicio) };
  } catch (erro) {
    const codigo = (erro as { code?: unknown }).code;
    const motivo =
      typeof codigo === "string" && /^[A-Z0-9_]+$/.test(codigo)
        ? codigo
        : erro instanceof Error && erro.message === "timeout"
          ? `timeout após ${timeoutMs} ms`
          : erro instanceof Error
            ? erro.name
            : "erro desconhecido";
    return { status: "error", latency_ms: Math.round(performance.now() - inicio), error: motivo };
  } finally {
    clearTimeout(timer);
  }
}
