# infra

Infraestrutura e implantação.

| Pasta | Conteúdo | Issue |
|---|---|---|
| `compose/` | Docker Compose de desenvolvimento ([README](compose/README.md)) e de produção (`docker-compose.yml`, [instalação](../docs/03-infraestrutura.md#36-instalação-nó-único)) | #5, #46 |
| `docker/` | Dockerfiles das imagens de produção ([README](docker/README.md)) | #45 |
| `servidor/` | Preparação de um servidor Ubuntu e deploy contínuo a cada merge na `main` ([README](servidor/README.md)) | #47 |
| `helm/` | Chart para Kubernetes, Fase 3 | — |
| `grafana/` | Dashboards versionados, Fase 3 | — |

Ver [Infraestrutura](../docs/03-infraestrutura.md).
