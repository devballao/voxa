import type { Valkey } from "iovalkey";
import type { Logger } from "pino";

/** Uma tarefa lida do stream: ID gerado pelo Valkey e os campos (chave → valor). */
export interface Tarefa {
  id: string;
  campos: Record<string, string>;
}

export type Processador = (tarefa: Tarefa) => Promise<void>;

export interface OpcoesConsumidor {
  valkey: Valkey;
  logger: Logger;
  stream: string;
  grupo: string;
  consumidor: string;
  processar: Processador;
  /** Quanto tempo cada leitura espera por tarefas novas, em ms. Limita o tempo de encerramento. */
  esperaMs?: number;
  /** Tarefas por leitura. */
  lote?: number;
}

export interface Consumidor {
  /** Resolve quando o laço termina (após `parar()`). */
  readonly concluido: Promise<void>;
  /** Pede o fim do laço: termina após a leitura em andamento (até `esperaMs`). */
  parar(): void;
}

/** Converte a resposta do XREADGROUP em tarefas. */
export function converterResposta(resposta: unknown): Tarefa[] {
  if (!Array.isArray(resposta)) return [];
  const tarefas: Tarefa[] = [];
  for (const [, entradas] of resposta as [string, [string, string[]][]][]) {
    for (const [id, lista] of entradas) {
      const campos: Record<string, string> = {};
      for (let i = 0; i + 1 < lista.length; i += 2) {
        campos[lista[i] as string] = lista[i + 1] as string;
      }
      tarefas.push({ id, campos });
    }
  }
  return tarefas;
}

/** Cria o grupo de consumidores (e o stream, se preciso). Idempotente. */
export async function garantirGrupo(valkey: Valkey, stream: string, grupo: string): Promise<void> {
  try {
    await valkey.xgroup("CREATE", stream, grupo, "$", "MKSTREAM");
  } catch (erro) {
    if (!(erro instanceof Error && erro.message.startsWith("BUSYGROUP"))) throw erro;
  }
}

/**
 * Consome tarefas do stream com um consumer group: cada tarefa vai para um único
 * worker e só é confirmada (XACK) depois de processada com sucesso. Tarefas que
 * falham ficam pendentes no grupo, para nova tentativa (a recuperação automática
 * fica para o MVP).
 */
export function iniciarConsumidor(opcoes: OpcoesConsumidor): Consumidor {
  const { valkey, logger, stream, grupo, consumidor, processar } = opcoes;
  const esperaMs = opcoes.esperaMs ?? 2000;
  const lote = opcoes.lote ?? 10;
  let ativo = true;

  const laco = async () => {
    await garantirGrupo(valkey, stream, grupo);
    logger.info({ stream, grupo, consumidor }, "consumindo tarefas");
    while (ativo) {
      let tarefas: Tarefa[];
      try {
        const resposta = await valkey.xreadgroup(
          "GROUP",
          grupo,
          consumidor,
          "COUNT",
          lote,
          "BLOCK",
          esperaMs,
          "STREAMS",
          stream,
          ">",
        );
        tarefas = converterResposta(resposta);
      } catch (erro) {
        if (!ativo) break;
        logger.warn({ motivo: (erro as Error).message }, "falha ao ler o stream; tentando de novo");
        await new Promise((r) => setTimeout(r, esperaMs));
        continue;
      }
      for (const tarefa of tarefas) {
        try {
          await processar(tarefa);
          await valkey.xack(stream, grupo, tarefa.id);
        } catch (erro) {
          logger.error(
            { id: tarefa.id, motivo: (erro as Error).message },
            "tarefa falhou; ficará pendente",
          );
        }
      }
    }
    logger.info({ stream }, "consumidor parado");
  };

  const concluido = laco();
  return {
    concluido,
    parar() {
      ativo = false;
    },
  };
}
