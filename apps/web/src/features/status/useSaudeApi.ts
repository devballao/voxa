import { useEffect, useState } from "react";
import { lerSaude, type ResultadoSaude } from "../../lib/api.ts";

/** Consulta o /health da API a cada `intervaloMs`. `null` até a primeira resposta. */
export function useSaudeApi(intervaloMs = 5000): ResultadoSaude | null {
  const [resultado, setResultado] = useState<ResultadoSaude | null>(null);

  useEffect(() => {
    const controle = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const consultar = async () => {
      const r = await lerSaude(fetch, controle.signal);
      if (controle.signal.aborted) return;
      setResultado(r);
      timer = setTimeout(consultar, intervaloMs);
    };
    void consultar();
    return () => {
      controle.abort();
      clearTimeout(timer);
    };
  }, [intervaloMs]);

  return resultado;
}
