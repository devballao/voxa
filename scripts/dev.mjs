#!/usr/bin/env node
// pnpm dev — sobe API, gateway, worker e app web (com hot reload) via Turborepo.
// Antes, confere o que costuma dar errado e explica como resolver.
import { spawn } from "node:child_process";
import {
  existeEnv,
  falhar,
  infraPendente,
  ok,
  PORTAS_DEV,
  pnpm,
  portaLivre,
  RAIZ,
  verificarDocker,
  verificarNode,
} from "./lib/verificacoes.mjs";

verificarNode();
if (!existeEnv()) falhar("Arquivo .env não encontrado. Rode primeiro: pnpm bootstrap");

const ocupadas = [];
for (const { porta, servico } of PORTAS_DEV) {
  if (!(await portaLivre(porta))) ocupadas.push(`  - ${porta} (${servico})`);
}
if (ocupadas.length > 0) {
  falhar(
    `Portas já em uso:\n${ocupadas.join("\n")}\n` +
      "  Outro `pnpm dev` está rodando? Feche-o (Ctrl+C) ou descubra o processo:\n" +
      "  ss -ltnp | grep <porta>   (Linux)   ·   lsof -i :<porta>   (macOS)",
  );
}
ok("Portas 3000, 4000 e 5173 livres");

verificarDocker();
const pendentes = infraPendente();
if (pendentes.length > 0) {
  console.log(`→ Infraestrutura não está pronta (${pendentes.join(", ")}). Subindo…`);
  pnpm(["dev:infra"], "Subir a infraestrutura");
} else {
  ok("Infraestrutura saudável");
}

console.log("\nIniciando API, gateway, worker e app web. Ctrl+C encerra tudo.");
console.log("App web: http://localhost:5173\n");

const turbo = spawn("pnpm", ["exec", "turbo", "run", "dev"], { cwd: RAIZ, stdio: "inherit" });
for (const sinal of ["SIGINT", "SIGTERM"]) process.on(sinal, () => turbo.kill(sinal));
turbo.on("exit", (codigo, sinal) => process.exit(codigo ?? (sinal ? 0 : 1)));
