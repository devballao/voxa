import { useEffect, useState } from "react";
import { PaginaStatus } from "./PaginaStatus.tsx";
import { useGateway } from "./useGateway.ts";
import { useSaudeApi } from "./useSaudeApi.ts";

/** Liga a página de status aos dados reais (API e gateway). */
export function StatusDoAmbiente() {
  const saude = useSaudeApi();
  const gateway = useGateway();
  const [agora, setAgora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <PaginaStatus saude={saude} gateway={gateway} agora={agora} />;
}
