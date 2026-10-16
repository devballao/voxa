import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ResultadoSaude } from "../../lib/api.ts";
import { ESTADO_INICIAL, type EstadoGateway } from "../../lib/gateway.ts";
import { PaginaStatus } from "./PaginaStatus.tsx";

const apiOk: ResultadoSaude = {
  tipo: "resposta",
  http: 200,
  saude: {
    status: "ok",
    version: "0.0.0",
    uptime_s: 12,
    checks: {
      postgres: { status: "ok", latency_ms: 5.6 },
      valkey: { status: "ok", latency_ms: 1 },
      s3: { status: "ok", latency_ms: 8 },
      livekit: { status: "ok", latency_ms: 6 },
    },
  },
};

const gwOk: EstadoGateway = {
  ...ESTADO_INICIAL,
  conexao: "conectado",
  hello: true,
  heartbeatIntervalMs: 41_250,
  heartbeatsEnviados: 2,
  acksRecebidos: 2,
  ultimoAckEm: 1_000,
};

const resumo = () => screen.getByRole("status");

describe("PaginaStatus", () => {
  it("tudo verde: 'Tudo funcionando', dependências e números em pt-BR", () => {
    render(<PaginaStatus saude={apiOk} gateway={gwOk} agora={4_000} />);
    expect(resumo()).toHaveTextContent("Tudo funcionando");
    const linhaPostgres = screen.getByRole("row", { name: /PostgreSQL/ });
    expect(within(linhaPostgres).getByText("5,6 ms")).toBeInTheDocument();
    expect(screen.getByText(/heartbeat a cada 41,25 s/)).toBeInTheDocument();
    expect(screen.getByText(/2 de 2 confirmados/)).toBeInTheDocument();
    expect(screen.getByText(/último ACK há 3 s/)).toBeInTheDocument();
  });

  it("enquanto carrega: 'Verificando…'", () => {
    render(<PaginaStatus saude={null} gateway={ESTADO_INICIAL} />);
    expect(resumo()).toHaveTextContent("Verificando…");
    expect(screen.getByText("Consultando…")).toBeInTheDocument();
  });

  it("API fora do ar: problema e motivo", () => {
    render(
      <PaginaStatus
        saude={{ tipo: "inacessivel", motivo: "API fora do ar (o proxy respondeu HTTP 502)" }}
        gateway={gwOk}
      />,
    );
    expect(resumo()).toHaveTextContent("Há serviços com problema");
    expect(screen.getByText("API inacessível")).toBeInTheDocument();
    expect(screen.getByText(/proxy respondeu HTTP 502/)).toBeInTheDocument();
  });

  it("dependência com erro aparece com o motivo", () => {
    const comFalha: ResultadoSaude = {
      tipo: "resposta",
      http: 503,
      saude: {
        ...apiOk.saude,
        status: "error",
        checks: {
          ...apiOk.saude.checks,
          postgres: { status: "error", latency_ms: 2, error: "ECONNREFUSED" },
        },
      },
    } as ResultadoSaude;
    render(<PaginaStatus saude={comFalha} gateway={gwOk} />);
    expect(resumo()).toHaveTextContent("Há serviços com problema");
    expect(
      within(screen.getByRole("row", { name: /PostgreSQL/ })).getByText(/ECONNREFUSED/),
    ).toBeInTheDocument();
  });

  it("gateway reconectando: tentativa, fechamento e evento recebido", () => {
    render(
      <PaginaStatus
        saude={apiOk}
        gateway={{
          ...gwOk,
          conexao: "reconectando",
          hello: false,
          tentativas: 2,
          ultimoFechamento: { codigo: 1001, motivo: "servidor reiniciando" },
          ultimoEvento: { t: "DEV_PING", s: 1, d: { message: "oi" }, em: 1 },
        }}
      />,
    );
    expect(resumo()).toHaveTextContent("Há serviços com problema");
    expect(screen.getByText("reconectando…")).toBeInTheDocument();
    expect(screen.getByText(/tentativa 2/)).toBeInTheDocument();
    expect(screen.getByText(/código 1001 \(servidor reiniciando\)/)).toBeInTheDocument();
    expect(screen.getByText(/DEV_PING #1/)).toBeInTheDocument();
  });

  it("gateway conectado mas sem ACK ainda não conta como saudável", () => {
    render(
      <PaginaStatus saude={apiOk} gateway={{ ...gwOk, acksRecebidos: 0, ultimoAckEm: null }} />,
    );
    expect(resumo()).toHaveTextContent("Há serviços com problema");
  });

  it("rodapé com a licença e o link para o código-fonte", () => {
    render(<PaginaStatus saude={apiOk} gateway={gwOk} />);
    expect(screen.getByRole("contentinfo")).toHaveTextContent("AGPL-3.0-or-later");
    expect(screen.getByRole("link", { name: "github.com/devballao/voxa" })).toHaveAttribute(
      "href",
      "https://github.com/devballao/voxa",
    );
  });
});
