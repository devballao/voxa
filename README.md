# Voxa

[![CI](https://github.com/devballao/voxa/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/devballao/voxa/actions/workflows/ci.yml)

**Voxa** é uma plataforma de comunicação em comunidade — chat de texto, salas de voz e compartilhamento de tela — **livre, de código aberto e sem fins lucrativos**. Qualquer pessoa pode usar a instância pública ou hospedar a sua própria.

> Status: **pré-alfa / fase de design**. A arquitetura descrita em [`docs/`](docs/README.md) é uma proposta aberta a discussão.

## Princípios

- **Comunidade antes de lucro** — sem anúncios, sem venda de dados, sem recursos de qualidade atrás de assinatura.
- **Auto-hospedável** — roda num único servidor com `docker compose`, e escala horizontalmente quando necessário.
- **Privacidade por padrão** — coleta mínima de dados, criptografia em trânsito sempre, ponta a ponta nas chamadas (opcional por sala).
- **Padrões abertos** — WebRTC, Opus, WebSocket, S3, OIDC. Nada de protocolos proprietários.

## Documentação

| | |
|---|---|
| [Visão geral](docs/01-visao-geral.md) | Objetivos, escopo e glossário |
| [Arquitetura](docs/02-arquitetura.md) | Componentes e como se conectam |
| [Infraestrutura](docs/03-infraestrutura.md) | Implantação, rede, armazenamento, observabilidade e custos |
| [Backend](docs/04-backend.md) | API REST, gateway em tempo real, dados e permissões |
| [Chat](docs/05-chat.md) | Fluxo de mensagens |
| [Voz](docs/06-voz.md) | Salas de voz |
| [Compartilhamento de tela](docs/07-compartilhamento-de-tela.md) | Transmissões ao vivo |
| [Aplicação cliente](docs/08-cliente.md) | Web, desktop e mobile |
| [Segurança e privacidade](docs/09-seguranca-e-privacidade.md) | Modelo de ameaças, criptografia, LGPD |
| [Desenvolvimento](docs/10-desenvolvimento.md) | Ambiente local, convenções, CI/CD |
| [Roadmap](docs/11-roadmap.md) | Fases do projeto |
| [Decisões (ADRs)](docs/adr/README.md) | Registro das decisões de arquitetura |

## Rodando localmente

Requisitos: Node.js 24, pnpm 12 (`corepack enable`) e Docker.

```bash
pnpm install
pnpm bootstrap   # primeira vez: .env, infraestrutura e migrações
pnpm dev         # API, gateway, worker e app web → http://localhost:5173
```

Detalhes em [Desenvolvimento §10.2](docs/10-desenvolvimento.md#102-ambiente-local).

## Contribuindo

Leia o [guia de contribuição](CONTRIBUTING.md). Toda ajuda é bem-vinda — código, design, tradução, documentação e testes.
