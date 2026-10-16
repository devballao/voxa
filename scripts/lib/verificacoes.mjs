// Verificações compartilhadas por scripts/bootstrap.mjs e scripts/dev.mjs.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

export const RAIZ = fileURLToPath(new URL("../../", import.meta.url));
export const COMPOSE = `${RAIZ}infra/compose/docker-compose.dev.yml`;
export const ENV = `${RAIZ}.env`;
export const SERVICOS_INFRA = ["postgres", "valkey", "garage", "livekit", "mailpit"];

/** Portas usadas pelo `pnpm dev`. */
export const PORTAS_DEV = [
  { porta: 3000, servico: "API" },
  { porta: 4000, servico: "gateway" },
  { porta: 5173, servico: "app web (Vite)" },
];

export function falhar(mensagem) {
  console.error(`\n✗ ${mensagem}\n`);
  process.exit(1);
}

export function ok(mensagem) {
  console.log(`✓ ${mensagem}`);
}

/** Node na versão exigida por "engines" (major 24). */
export function verificarNode() {
  const pacote = JSON.parse(readFileSync(`${RAIZ}package.json`, "utf8"));
  const exigido = pacote.engines.node; // ex.: ">=24.11.0 <25"
  const [maj, min] = process.versions.node.split(".").map(Number);
  const [, eMaj, eMin] = exigido.match(/>=(\d+)\.(\d+)/) ?? [];
  if (maj !== Number(eMaj) || min < Number(eMin)) {
    falhar(
      `Node ${process.versions.node} não atende a "${exigido}".\n` +
        "  Use a versão do .nvmrc: nvm install && nvm use (ou fnm use, volta, asdf…).",
    );
  }
  ok(`Node ${process.versions.node}`);
}

export function verificarDocker() {
  const r = spawnSync("docker", ["info", "--format", "{{.ServerVersion}}"], { encoding: "utf8" });
  if (r.error) falhar("Docker não encontrado. Instale o Docker (com Compose v2) e tente de novo.");
  if (r.status !== 0) {
    falhar(
      "O Docker está instalado, mas não está respondendo. Inicie o Docker Desktop (ou: sudo systemctl start docker).",
    );
  }
  ok(`Docker ${r.stdout.trim()}`);
}

/** Serviços da infraestrutura que não estão `healthy`. */
export function infraPendente() {
  const r = spawnSync(
    "docker",
    ["compose", "-f", COMPOSE, "ps", "--format", "{{.Service}} {{.Health}}"],
    {
      encoding: "utf8",
    },
  );
  if (r.status !== 0) return SERVICOS_INFRA;
  const saudaveis = new Set(
    r.stdout
      .split("\n")
      .filter((l) => l.endsWith(" healthy"))
      .map((l) => l.split(" ")[0]),
  );
  return SERVICOS_INFRA.filter((s) => !saudaveis.has(s));
}

export function existeEnv() {
  return existsSync(ENV);
}

/** Tenta ocupar a porta num endereço: `false` só se alguém já escuta nela. */
function livreEm(porta, endereco) {
  return new Promise((resolver) => {
    const s = createServer();
    // EADDRINUSE: ocupada. Outros erros (ex.: máquina sem IPv6) não contam como ocupada.
    s.once("error", (erro) => resolver(erro.code !== "EADDRINUSE"));
    s.once("listening", () => s.close(() => resolver(true)));
    s.listen(porta, endereco);
  });
}

/**
 * Resolve true se ninguém está escutando na porta, em IPv4 **e** IPv6.
 * O Vite escuta em `localhost`, que em alguns sistemas (Codespaces, runners do GitHub)
 * é o `::1`: testar só 127.0.0.1 deixaria passar um `pnpm dev` antigo ainda aberto.
 */
export async function portaLivre(porta) {
  return (await livreEm(porta, "127.0.0.1")) && (await livreEm(porta, "::1"));
}

/** Roda `pnpm <args>` mostrando a saída; encerra com erro se falhar. */
export function pnpm(args, descricao) {
  const r = spawnSync("pnpm", args, { cwd: RAIZ, stdio: "inherit" });
  if (r.status !== 0) falhar(`${descricao} falhou (veja as mensagens acima).`);
}
