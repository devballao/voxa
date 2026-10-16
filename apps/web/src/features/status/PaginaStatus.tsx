import type { HealthDependency } from "@voxa/protocol/http";
import type { ResultadoSaude } from "../../lib/api.ts";
import type { EstadoGateway } from "../../lib/gateway.ts";

const NOMES: Record<HealthDependency, string> = {
  postgres: "PostgreSQL",
  valkey: "Valkey",
  s3: "Armazenamento (S3)",
  livekit: "LiveKit (mídia)",
};

const CONEXAO: Record<EstadoGateway["conexao"], string> = {
  conectando: "conectando…",
  conectado: "conectado",
  reconectando: "reconectando…",
  parado: "parado",
};

/** Repositório do código-fonte: a AGPL pede que quem usa o serviço pela rede possa obtê-lo. */
export const CODIGO_FONTE = "https://github.com/devballao/voxa";

const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

export interface PropsPaginaStatus {
  saude: ResultadoSaude | null;
  gateway: EstadoGateway;
  agora?: number;
}

/** Selo de status: o texto diz o estado; a cor só reforça. */
function Selo({ ok, texto }: { ok: boolean | null; texto: string }) {
  const classe = ok === null ? "selo selo-neutro" : ok ? "selo selo-ok" : "selo selo-erro";
  return (
    <span className={classe}>
      <span aria-hidden="true">{ok === null ? "…" : ok ? "✓" : "✕"}</span> {texto}
    </span>
  );
}

export function apiSaudavel(saude: ResultadoSaude | null): boolean | null {
  if (!saude) return null;
  return saude.tipo === "resposta" && saude.saude.status === "ok";
}

export function gatewaySaudavel(g: EstadoGateway): boolean | null {
  if (g.conexao === "conectando") return null;
  return g.conexao === "conectado" && g.hello && g.acksRecebidos > 0;
}

export function PaginaStatus({ saude, gateway, agora = Date.now() }: PropsPaginaStatus) {
  const api = apiSaudavel(saude);
  const gw = gatewaySaudavel(gateway);
  const tudoOk = api === true && gw === true;
  const carregando = api === null || gw === null;

  return (
    <div className="pagina">
      <main>
        <header>
          <h1>Voxa · Status do ambiente</h1>
          <p role="status" aria-live="polite" className="resumo">
            {carregando ? (
              <Selo ok={null} texto="Verificando…" />
            ) : tudoOk ? (
              <Selo ok texto="Tudo funcionando" />
            ) : (
              <Selo ok={false} texto="Há serviços com problema" />
            )}
          </p>
        </header>

        <section aria-labelledby="titulo-api" className="cartao">
          <h2 id="titulo-api">
            API <code>/api/v1/health</code>
          </h2>
          {saude === null ? (
            <p>Consultando…</p>
          ) : saude.tipo === "inacessivel" ? (
            <p>
              <Selo ok={false} texto="API inacessível" />{" "}
              <span className="detalhe">{saude.motivo}</span>
            </p>
          ) : (
            <>
              <p className="detalhe">
                HTTP {saude.http} · versão {saude.saude.version} · no ar há{" "}
                {numero.format(saude.saude.uptime_s)} s
              </p>
              <table>
                <thead>
                  <tr>
                    <th scope="col">Dependência</th>
                    <th scope="col">Status</th>
                    <th scope="col">Latência</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(NOMES) as HealthDependency[]).map((nome) => {
                    const c = saude.saude.checks[nome];
                    return (
                      <tr key={nome}>
                        <th scope="row">{NOMES[nome]}</th>
                        <td>
                          <Selo
                            ok={c?.status === "ok"}
                            texto={c?.status === "ok" ? "ok" : (c?.error ?? "sem dados")}
                          />
                        </td>
                        <td>{c ? `${numero.format(c.latency_ms)} ms` : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section aria-labelledby="titulo-gateway" className="cartao">
          <h2 id="titulo-gateway">
            Gateway <code>/gateway</code>
          </h2>
          <dl>
            <dt>Conexão</dt>
            <dd>
              <Selo
                ok={gateway.conexao === "conectando" ? null : gateway.conexao === "conectado"}
                texto={CONEXAO[gateway.conexao]}
              />
              {gateway.tentativas > 0 && (
                <span className="detalhe"> · tentativa {gateway.tentativas}</span>
              )}
            </dd>
            <dt>HELLO</dt>
            <dd>
              {gateway.hello
                ? `recebido (heartbeat a cada ${numero.format((gateway.heartbeatIntervalMs ?? 0) / 1000)} s)`
                : "aguardando"}
            </dd>
            <dt>Heartbeats</dt>
            <dd>
              {gateway.acksRecebidos} de {gateway.heartbeatsEnviados} confirmados
              {gateway.ultimoAckEm !== null && (
                <span className="detalhe">
                  {" "}
                  · último ACK há {Math.max(0, Math.round((agora - gateway.ultimoAckEm) / 1000))} s
                </span>
              )}
            </dd>
            <dt>Último evento</dt>
            <dd>
              {gateway.ultimoEvento ? (
                <code>
                  {gateway.ultimoEvento.t} #{gateway.ultimoEvento.s}{" "}
                  {JSON.stringify(gateway.ultimoEvento.d)}
                </code>
              ) : (
                <span className="detalhe">nenhum (publique em dev:ping para testar)</span>
              )}
            </dd>
            {gateway.ultimoFechamento && (
              <>
                <dt>Último fechamento</dt>
                <dd>
                  código {gateway.ultimoFechamento.codigo}
                  {gateway.ultimoFechamento.motivo && ` (${gateway.ultimoFechamento.motivo})`}
                </dd>
              </>
            )}
          </dl>
        </section>
      </main>

      {/* Fora do <main>: só assim o rodapé é o landmark "contentinfo" para leitores de tela. */}
      <footer className="rodape">
        O Voxa é software livre, sob a licença{" "}
        <a href={`${CODIGO_FONTE}/blob/main/LICENSE`}>AGPL-3.0-or-later</a>. Código-fonte:{" "}
        <a href={CODIGO_FONTE}>github.com/devballao/voxa</a>
      </footer>
    </div>
  );
}
