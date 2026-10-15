#!/usr/bin/env node
// Orquestra os serviços de apoio de desenvolvimento (docker-compose.dev.yml).
//
//   node infra/compose/scripts/dev-infra.mjs up      sobe, espera os healthchecks e inicializa o Garage
//   node infra/compose/scripts/dev-infra.mjs down    para os contêineres (mantém os dados)
//   node infra/compose/scripts/dev-infra.mjs reset   para e APAGA os volumes (dados de dev)
//
// Escrito em Node (e não em shell) para funcionar igual no Linux, macOS e Windows.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const composeFile = fileURLToPath(new URL("../docker-compose.dev.yml", import.meta.url));
const envFile = fileURLToPath(new URL("../../../.env", import.meta.url));

// Valores padrão iguais aos do .env.example; o .env da raiz, se existir, tem prioridade.
const env = {
  S3_ACCESS_KEY_ID: "GK766f78612d6465762d6b6579",
  S3_SECRET_ACCESS_KEY: "766f78612d6465762d7365637265742d6170656e61732d706172612d6465763031",
  S3_BUCKET: "voxa-dev",
  ...lerEnv(envFile),
};

function lerEnv(arquivo) {
  if (!existsSync(arquivo)) return {};
  const valores = {};
  for (const linha of readFileSync(arquivo, "utf8").split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m?.[1] && m[2] !== undefined) valores[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return valores;
}

function compose(args, { silencioso = false } = {}) {
  return spawnSync("docker", ["compose", "-f", composeFile, ...args], {
    encoding: "utf8",
    stdio: silencioso ? "pipe" : "inherit",
  });
}

function garage(...args) {
  return compose(["exec", "-T", "garage", "/garage", ...args], { silencioso: true });
}

function falhar(mensagem) {
  console.error(`\n✗ ${mensagem}`);
  process.exit(1);
}

function verificarDocker() {
  const r = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
  if (r.error) falhar("Docker não encontrado. Instale o Docker e tente de novo.");
  if (r.status !== 0) falhar("O Docker não está respondendo. Ele está em execução?");
}

function inicializarGarage() {
  const { S3_ACCESS_KEY_ID: chave, S3_SECRET_ACCESS_KEY: segredo, S3_BUCKET: bucket } = env;

  const layout = garage("layout", "show");
  if (/Current cluster layout version: 0\b/.test(layout.stdout)) {
    const no = garage("node", "id", "-q").stdout.trim().split("@")[0];
    if (!no) falhar(`Não foi possível obter o ID do nó do Garage.\n${layout.stderr}`);
    exigir(garage("layout", "assign", "-z", "dc1", "-c", "1G", no), "atribuir layout");
    exigir(garage("layout", "apply", "--version", "1"), "aplicar layout");
    console.log("  • Garage: layout criado");
  }

  if (garage("key", "info", chave).status !== 0) {
    exigir(garage("key", "import", "--yes", "-n", "voxa-dev", chave, segredo), "importar chave");
    console.log("  • Garage: chave de acesso importada");
  }

  if (garage("bucket", "info", bucket).status !== 0) {
    exigir(garage("bucket", "create", bucket), "criar bucket");
    console.log(`  • Garage: bucket "${bucket}" criado`);
  }

  exigir(
    garage("bucket", "allow", "--read", "--write", "--owner", bucket, "--key", chave),
    "conceder permissões",
  );
}

function exigir(resultado, etapa) {
  if (resultado.status !== 0) falhar(`Garage: falha ao ${etapa}.\n${resultado.stderr}`);
}

const comando = process.argv[2];
verificarDocker();

switch (comando) {
  case "up": {
    console.log("Subindo Postgres, Valkey, Garage, LiveKit e Mailpit…");
    const r = compose(["up", "-d", "--wait", "--wait-timeout", "120"]);
    if (r.status !== 0) {
      falhar(
        "Os serviços não ficaram saudáveis. Veja os logs com:\n" +
          "  docker compose -f infra/compose/docker-compose.dev.yml logs\n" +
          "Porta ocupada? Consulte infra/compose/README.md.",
      );
    }
    inicializarGarage();
    console.log("\n✓ Infraestrutura de desenvolvimento pronta. Portas em infra/compose/README.md.");
    break;
  }
  case "down":
    process.exit(compose(["down"]).status ?? 1);
    break;
  case "reset":
    console.log("Parando os serviços e APAGANDO os volumes de desenvolvimento…");
    process.exit(compose(["down", "--volumes", "--remove-orphans"]).status ?? 1);
    break;
  default:
    falhar("Uso: dev-infra.mjs <up|down|reset>");
}
