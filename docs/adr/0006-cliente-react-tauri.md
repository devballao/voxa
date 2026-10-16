# 0006 — React no web e Tauri no desktop

- Status: **Aceito para o web**; desktop (Tauri) ainda **Proposto**
- Data: 2026-10-15 (proposto) · 2026-10-16 (web aceito; TanStack Router acrescentado)
- O app web existe desde o Milestone 0 ([#10](https://github.com/devballao/voxa/issues/10)). O desktop fica para a Fase 2 e será confirmado (ou trocado por Electron) quando o WebRTC for testado nos três sistemas, como prevê o risco abaixo.

## Contexto

Precisamos de um cliente web completo e de um app desktop com recursos nativos (seletor de tela, push-to-talk global, bandeja), mantidos por uma equipe pequena.

## Decisão

- **Web:** React 19 + Vite, **TanStack Router** (rotas com tipos verificados), Zustand (estado ao vivo), TanStack Query (dados remotos), Radix UI (acessibilidade), i18next.
- **Desktop:** Tauri 2, que reaproveita o build web e implementa os recursos nativos em Rust (plugins).
- Lógica de cliente em `@voxa/client-core`, sem dependência de React, para reaproveitar no mobile.

## Alternativas consideradas

| Opção | Avaliação |
|---|---|
| Electron | Chromium idêntico em todos os SOs (WebRTC previsível); binário e memória muito maiores |
| Flutter | Um código para todas as plataformas; WebRTC e acessibilidade no web menos maduros |
| SolidJS / Svelte | Mais leves; ecossistema e público de contribuidores menores que React |
| React Router (no lugar do TanStack Router) | Mais conhecido; parâmetros e *search params* sem tipos verificados, e integração menos direta com o TanStack Query |

## Consequências e riscos

- **Risco:** o WebKitGTK (Linux) e o WKWebView (macOS) têm suporte a WebRTC e Insertable Streams diferente do Chromium. Mitigação: matriz de testes E2E por SO e, se necessário, captura e codificação de tela no lado Rust.
- Se o risco se confirmar de forma bloqueante, um novo ADR pode trocar o desktop para Electron sem afetar o app web.
