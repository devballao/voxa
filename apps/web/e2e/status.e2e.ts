import { expect, test } from "@playwright/test";
import { HealthResponse } from "@voxa/protocol/http";
import { capturar } from "./demonstracao.ts";

test("a página de status fica verde com todos os serviços no ar", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Voxa · Status do ambiente");
  // O gateway só conta como saudável depois do primeiro HEARTBEAT_ACK.
  await expect(page.getByRole("status")).toHaveText(/Tudo funcionando/, { timeout: 60_000 });
  await expect(page.getByRole("contentinfo")).toContainText("AGPL-3.0-or-later");

  await capturar(page, {
    id: "status-tudo-verde",
    titulo: "Página de status",
    descricao:
      "API, gateway, PostgreSQL, Valkey, S3 e LiveKit no ar. No rodapé, a licença (AGPL-3.0) e o link para o código-fonte.",
  });
});

test("a API responde /api/v1/health no formato do protocolo", async ({ page, request }) => {
  const resposta = await request.get("/api/v1/health");
  expect(resposta.status()).toBe(200);
  const saude = HealthResponse.parse(await resposta.json());
  expect(saude.status).toBe("ok");

  await page.goto("/api/v1/health");
  await capturar(page, {
    id: "api-health",
    titulo: "API: /api/v1/health",
    descricao: `Resposta da API na versão ${saude.version}, com a latência de cada dependência.`,
  });
});
