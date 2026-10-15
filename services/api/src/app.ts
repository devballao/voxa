import { API_BASE_PATH } from "@voxa/protocol";
import type { ErrorCode, ErrorResponse } from "@voxa/protocol/http";
import Fastify, {
  type FastifyError,
  type FastifyInstance,
  type FastifyServerOptions,
} from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import type { Verificacoes } from "./health/checks.ts";
import { rotaHealth } from "./routes/health.ts";

export interface OpcoesApp {
  verificacoes: Verificacoes;
  versao: string;
  logger?: FastifyServerOptions["logger"];
}

/** Campos que nunca aparecem nos logs. */
export const CAMPOS_OCULTOS_NO_LOG = [
  "req.headers.authorization",
  "req.headers.cookie",
  'res.headers["set-cookie"]',
];

/** Trunca o IP para o log: /24 no IPv4 e /48 no IPv6 (docs/09-seguranca-e-privacidade.md). */
export function truncarIp(ip: string | undefined): string | undefined {
  if (!ip) return undefined;
  const v4 = ip.replace(/^::ffff:/, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) return v4.replace(/\.\d+$/, ".0");
  return `${ip.split(":").slice(0, 3).join(":")}::`;
}

/**
 * Serializa a requisição para o log sem dados sensíveis: só o caminho
 * (a query string pode conter tokens) e o IP truncado.
 */
export function serializarRequisicao(req: { method: string; url: string; ip?: string }) {
  return { method: req.method, path: req.url.split("?")[0], ip: truncarIp(req.ip) };
}

export function erro(code: ErrorCode, message: string, details?: Record<string, unknown>) {
  const corpo: ErrorResponse = { error: { code, message } };
  if (details) corpo.error.details = details;
  return corpo;
}

/** Monta a aplicação Fastify (sem abrir porta). Usado pelo main.ts e pelos testes. */
export async function construirApp(opcoes: OpcoesApp): Promise<FastifyInstance> {
  const app = Fastify({
    logger: opcoes.logger ?? false,
    // Requisições sem resposta em 30 s são encerradas.
    requestTimeout: 30_000,
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.setErrorHandler<FastifyError>((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      return reply.code(400).send(
        erro("VALIDATION_FAILED", "A requisição tem campos inválidos.", {
          issues: err.validation.map((v) => ({ path: v.instancePath, message: v.message })),
        }),
      );
    }
    if (err.statusCode === 429) {
      return reply.code(429).send(erro("RATE_LIMITED", "Muitas requisições. Tente mais tarde."));
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      return reply.code(err.statusCode).send(erro("VALIDATION_FAILED", err.message));
    }
    // Erro inesperado: registra tudo no log, mas não expõe detalhes ao cliente.
    req.log.error({ err }, "erro não tratado");
    return reply.code(500).send(erro("INTERNAL_ERROR", "Erro interno. Tente novamente."));
  });

  app.setNotFoundHandler((req, reply) => {
    reply
      .code(404)
      .send(erro("NOT_FOUND", `Rota não encontrada: ${req.method} ${req.url.split("?")[0]}`));
  });

  await app.register(rotaHealth, {
    prefix: API_BASE_PATH,
    verificacoes: opcoes.verificacoes,
    versao: opcoes.versao,
  });

  return app;
}
