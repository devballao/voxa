import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export interface Captura {
  /** Nome do arquivo, sem extensão (ex.: `status-tudo-verde`). */
  id: string;
  /** Título curto, mostrado na página de resumo. */
  titulo: string;
  /** O que a captura mostra, em uma ou duas frases. */
  descricao: string;
}

/**
 * Registra uma captura de tela para a página de demonstração da etapa.
 * Só faz algo quando o `pnpm demo` define VOXA_DEMO_DIR; nos testes comuns, não faz nada.
 */
export async function capturar(page: Page, captura: Captura): Promise<void> {
  const pasta = process.env.VOXA_DEMO_DIR;
  if (!pasta) return;
  mkdirSync(pasta, { recursive: true });
  const arquivo = `${captura.id}.png`;
  await page.screenshot({ path: join(pasta, arquivo), fullPage: true });
  // Uma linha JSON por captura, na ordem em que os cenários rodam.
  appendFileSync(join(pasta, "capturas.jsonl"), `${JSON.stringify({ ...captura, arquivo })}\n`);
}
