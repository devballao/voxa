#!/usr/bin/env node
// pnpm demo — demonstração da etapa atual: sobe o ambiente (se preciso), roda os
// cenários E2E tirando capturas de tela e gera a página de resumo em demo/milestone-<N>/.
//
//   pnpm demo                  etapa atual (o milestone aberto mais antigo no GitHub)
//   pnpm demo --milestone 2    um milestone específico (número do GitHub)
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { gerarResumo, milestoneAtual, repositorioDoPacote } from "./lib/resumo-demo.mjs";
import { falhar, ok, RAIZ, verificarNode } from "./lib/verificacoes.mjs";

// "localhost", não 127.0.0.1: o Vite escuta em localhost, que em algumas máquinas
// (como os runners do GitHub) resolve para o IPv6 ::1. O fetch e o Chromium tentam os dois.
const URL_APP = "http://localhost:5173";
const ESPERA_MAXIMA_MS = 180_000;

verificarNode();

const repo = repositorioDoPacote(RAIZ);
const i = process.argv.indexOf("--milestone");
const numero = i > 0 ? Number(process.argv[i + 1]) : await milestoneAtual(repo);
if (!Number.isInteger(numero)) {
  falhar("Não deu para descobrir a etapa atual no GitHub. Informe: pnpm demo --milestone <número>");
}

const pasta = join(RAIZ, "demo", `milestone-${numero}`);
rmSync(pasta, { recursive: true, force: true });
mkdirSync(pasta, { recursive: true });
ok(`Demonstração do milestone ${numero} em demo/milestone-${numero}/`);

let ultimoMotivo = "sem resposta";

/** `true` quando o app web responde e a API (pelo proxy do Vite) está saudável. */
async function ambienteNoAr() {
  try {
    const res = await fetch(`${URL_APP}/api/v1/health`, { signal: AbortSignal.timeout(3_000) });
    ultimoMotivo = `HTTP ${res.status} em /api/v1/health`;
    return res.ok;
  } catch (erro) {
    ultimoMotivo = erro.cause?.code ?? erro.message;
    return false;
  }
}

// Navegador do Playwright: baixa na primeira vez e confere que abre, antes de subir o ambiente.
const PLAYWRIGHT = ["--filter", "@voxa/web", "exec", "playwright"];
const COM_DEPENDENCIAS = "pnpm --filter @voxa/web exec playwright install --with-deps chromium";
if (
  spawnSync("pnpm", [...PLAYWRIGHT, "install", "chromium"], { cwd: RAIZ, stdio: "inherit" })
    .status !== 0
) {
  falhar(`Não foi possível baixar o Chromium do Playwright. Tente: ${COM_DEPENDENCIAS}`);
}
const teste = spawnSync(
  "pnpm",
  [
    "--filter",
    "@voxa/web",
    "exec",
    "node",
    "--input-type=module",
    "-e",
    'import { chromium } from "@playwright/test"; await (await chromium.launch()).close();',
  ],
  { cwd: RAIZ, encoding: "utf8" },
);
if (teste.status !== 0) {
  const saida = `${teste.stdout}${teste.stderr}`;
  const faltaBiblioteca = /error while loading shared libraries|missing dependencies/i.test(saida);
  falhar(
    faltaBiblioteca
      ? "O Chromium não abre: faltam bibliotecas do sistema. Instale uma vez (usa sudo):\n" +
          `  ${COM_DEPENDENCIAS}`
      : `O Chromium do Playwright não abriu:\n${saida.trim().split("\n").slice(-5).join("\n")}`,
  );
}
ok("Chromium do Playwright pronto");

/** `true` se algo responde na porta do app web (mesmo que a API por trás esteja fora). */
async function appResponde() {
  try {
    await fetch(URL_APP, { signal: AbortSignal.timeout(3_000) });
    return true;
  } catch {
    return false;
  }
}

// Reaproveita um `pnpm dev` já rodando; senão, sobe um e o encerra no fim.
let dev;
if (await ambienteNoAr()) {
  ok("Ambiente já está no ar (pnpm dev): usando-o");
} else {
  if (await appResponde()) {
    falhar(
      `O app web responde em ${URL_APP}, mas a API não (${ultimoMotivo}).\n` +
        "  Há um pnpm dev antigo ou com problema rodando: encerre-o (Ctrl+C) e rode pnpm demo de novo.",
    );
  }
  console.log("→ Subindo o ambiente (pnpm dev)…");
  dev = spawn("node", [join(RAIZ, "scripts", "dev.mjs")], {
    cwd: RAIZ,
    stdio: ["ignore", "inherit", "inherit"],
    detached: true, // grupo próprio: no fim, encerra o turbo e todos os serviços juntos
  });
  const inicio = Date.now();
  while (!(await ambienteNoAr())) {
    if (dev.exitCode !== null) falhar("O pnpm dev encerrou antes de o ambiente ficar pronto.");
    if (Date.now() - inicio > ESPERA_MAXIMA_MS) {
      encerrarDev();
      falhar(
        `O ambiente não ficou pronto em ${ESPERA_MAXIMA_MS / 1000} s (${URL_APP}: ${ultimoMotivo}).`,
      );
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  ok(`Ambiente no ar em ${Math.round((Date.now() - inicio) / 1000)} s`);
}

function encerrarDev() {
  if (dev && dev.exitCode === null) {
    try {
      process.kill(-dev.pid, "SIGINT");
    } catch {}
  }
}
for (const sinal of ["SIGINT", "SIGTERM"]) {
  process.on(sinal, () => {
    encerrarDev();
    process.exit(1);
  });
}

console.log("\n→ Rodando os cenários (Playwright)…");
const testes = spawnSync("pnpm", ["--filter", "@voxa/web", "test:e2e"], {
  cwd: RAIZ,
  stdio: "inherit",
  env: { ...process.env, VOXA_DEMO_DIR: pasta, VOXA_E2E_URL: URL_APP },
});
const testesOk = testes.status === 0;

const commit =
  spawnSync("git", ["rev-parse", "--short", "HEAD"], {
    cwd: RAIZ,
    encoding: "utf8",
  }).stdout.trim() || "desconhecido";
const pagina = await gerarResumo({ pasta, repo, numero, testesOk, commit });

if (dev && dev.exitCode === null) {
  encerrarDev();
  await new Promise((r) => {
    dev.on("exit", r);
    setTimeout(r, 15_000).unref();
  });
}
console.log(`\n${testesOk ? "✓" : "✕"} Página de resumo: ${pagina}`);
if (!testesOk) falhar("Algum cenário falhou (veja acima). A página foi gerada mesmo assim.");
