/** Versão da API REST. Faz parte do caminho: `/api/v1`. */
export const API_VERSION = 1;

/** Prefixo de todas as rotas REST. */
export const API_BASE_PATH = `/api/v${API_VERSION}`;

/** Versão do protocolo do gateway, enviada como `?v=1` na URL do WebSocket. */
export const GATEWAY_VERSION = 1;

/** Caminho do WebSocket do gateway. */
export const GATEWAY_PATH = "/gateway";
