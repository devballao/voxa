# 0007 — Docker Compose como padrão, Kubernetes opcional

- Status: Proposto
- Data: 2026-10-15
- Situação (2026-10-16): hoje só existe o Compose de desenvolvimento ([#5](https://github.com/devballao/voxa/issues/5)). O Compose de produção será validado no **Milestone 2**, na primeira instância do projeto (Oracle Cloud *Always Free*, servidor ARM, custo zero), com deploy a cada merge na `main`.

## Contexto

A maioria das instâncias será pequena (coletivos, escolas, grupos), administrada por voluntários. Poucas precisarão de alta disponibilidade.

## Decisão

- **Caminho principal:** Docker Compose num único servidor, com Caddy (TLS automático, HTTP/3), scripts de backup e atualização.
- **Caminho de escala:** Helm chart para Kubernetes, com nós LiveKit em `hostNetwork` ou VMs dedicadas.
- Observabilidade embutida e opcional (perfil `observability` no Compose): Prometheus, Grafana, Loki, Alertmanager.
- Imagens multi-arquitetura (amd64 e arm64), para rodar também em servidores ARM baratos.

## Consequências

- Instalar uma instância leva minutos e exige pouco conhecimento de infraestrutura.
- Duas formas de implantação para manter; o CI testa as duas (Compose via E2E e Helm via `kind`).
