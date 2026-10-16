#!/usr/bin/env node
// pnpm bootstrap — prepara o ambiente de desenvolvimento na primeira vez.
// (O nome não é "setup" porque `pnpm setup` é um comando nativo do pnpm.)
import { copyFileSync } from "node:fs";
import {
  ENV,
  existeEnv,
  ok,
  pnpm,
  RAIZ,
  verificarDocker,
  verificarNode,
} from "./lib/verificacoes.mjs";

const inicio = Date.now();
console.log("Preparando o ambiente de desenvolvimento do Voxa…\n");

verificarNode();
verificarDocker();

if (existeEnv()) {
  ok(".env já existe (mantido como está)");
} else {
  copyFileSync(`${RAIZ}.env.example`, ENV);
  ok(".env criado a partir do .env.example (valores apenas de desenvolvimento)");
}

console.log("\n→ Subindo a infraestrutura (Postgres, Valkey, Garage, LiveKit, Mailpit)…");
pnpm(["dev:infra"], "Subir a infraestrutura");

console.log("\n→ Aplicando as migrações do banco…");
pnpm(["db:migrate"], "Aplicar as migrações");

const segundos = Math.round((Date.now() - inicio) / 1000);
console.log(`
✓ Ambiente pronto em ${segundos} s.

Próximo passo:
  pnpm dev          API :3000 · gateway :4000 · worker · app web http://localhost:5173

Outros comandos úteis:
  pnpm test:unit    testes rápidos (sem Docker)
  pnpm dev:infra:down / pnpm dev:infra:reset    parar / apagar os dados da infraestrutura
`);
