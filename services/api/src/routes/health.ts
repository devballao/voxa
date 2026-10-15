import { HealthDependency, HealthResponse } from "@voxa/protocol/http";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { executarVerificacao, type Verificacoes } from "../health/checks.ts";

export interface OpcoesHealth {
  verificacoes: Verificacoes;
  versao: string;
}

/** GET /health — 200 se todas as dependências estão ok; 503 caso contrário. */
export const rotaHealth: FastifyPluginAsyncZod<OpcoesHealth> = async (app, opcoes) => {
  app.get(
    "/health",
    { schema: { response: { 200: HealthResponse, 503: HealthResponse } } },
    async (_req, reply) => {
      const nomes = HealthDependency.options;
      const resultados = await Promise.all(
        nomes.map((nome) => executarVerificacao(opcoes.verificacoes[nome])),
      );
      const checks = Object.fromEntries(
        nomes.map((n, i) => [n, resultados[i]]),
      ) as HealthResponse["checks"];
      const saudavel = resultados.every((r) => r.status === "ok");

      for (const [nome, r] of Object.entries(checks)) {
        if (r.status === "error")
          app.log.warn({ dependencia: nome, motivo: r.error }, "health: dependência com falha");
      }

      return reply.code(saudavel ? 200 : 503).send({
        status: saudavel ? "ok" : "error",
        version: opcoes.versao,
        uptime_s: Math.round(process.uptime()),
        checks,
      });
    },
  );
};
