import type { ErrorCode, ErrorResponse } from "@voxa/protocol/http";

/** Status HTTP de cada código de erro. A API usa este mapa; o gateway, só o `code`. */
export const STATUS_POR_CODIGO = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  MISSING_PERMISSION: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const satisfies Record<ErrorCode, number>;

export interface OpcoesVoxaError {
  /** Dados estruturados para o cliente (ex.: `{ permission: "SEND_MESSAGES" }`). Nunca dados sensíveis. */
  details?: Record<string, unknown>;
  /** Erro original, só para o log. */
  cause?: unknown;
}

/**
 * Erro de domínio do Voxa (docs/10-desenvolvimento.md §10.4). Os serviços lançam
 * `VoxaError` com um `code` da lista fechada de `@voxa/protocol`; a camada de
 * entrada (API, gateway) o converte para a resposta ao cliente.
 */
export class VoxaError extends Error {
  override readonly name = "VoxaError";
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: ErrorCode, message: string, opcoes: OpcoesVoxaError = {}) {
    super(message, opcoes.cause === undefined ? undefined : { cause: opcoes.cause });
    this.code = code;
    this.details = opcoes.details;
  }

  /** Status HTTP sugerido para este erro. */
  get status(): number {
    return STATUS_POR_CODIGO[this.code];
  }

  /** Corpo da resposta no formato de `@voxa/protocol` (`ErrorResponse`). */
  paraResposta(): ErrorResponse {
    const corpo: ErrorResponse = { error: { code: this.code, message: this.message } };
    if (this.details) corpo.error.details = this.details;
    return corpo;
  }
}
