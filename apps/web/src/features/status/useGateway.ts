import { useEffect, useState } from "react";
import { criarClienteGateway, ESTADO_INICIAL, type EstadoGateway } from "../../lib/gateway.ts";

/** Mantém uma conexão com o gateway enquanto o componente estiver montado. */
export function useGateway(): EstadoGateway {
  const [estado, setEstado] = useState<EstadoGateway>(ESTADO_INICIAL);

  useEffect(() => {
    const cliente = criarClienteGateway({ aoMudar: setEstado });
    return () => cliente.parar();
  }, []);

  return estado;
}
