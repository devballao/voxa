# 0003 — LiveKit como servidor de mídia (SFU)

- Status: Proposto
- Data: 2026-10-15

## Contexto

Voz, câmera e tela exigem um SFU com simulcast, controle de congestionamento, TURN, reconexão, E2EE de quadros e escalabilidade horizontal. Construir isso do zero levaria anos.

## Decisão

Usar o **LiveKit Server** (Apache-2.0, auto-hospedável) com os SDKs `livekit-client` (web) e `livekit-server-sdk` (Node).

- O Voxa controla **quem** entra: a API emite tokens JWT por sala, com permissões por fonte (microfone, câmera, tela).
- O LiveKit cuida **da mídia**: transporte, simulcast, *adaptive stream*, *dynacast*, TURN embutido e E2EE.
- Os webhooks do LiveKit reconciliam o estado de voz do Voxa.

## Alternativas consideradas

| Opção | Avaliação |
|---|---|
| mediasoup | Excelente e flexível, mas é uma biblioteca: sinalização, TURN, escala e SDKs ficariam conosco |
| Janus | Maduro; configuração e extensão em C mais difíceis para quem contribui |
| Jitsi Videobridge | Ótimo para conferências; mais acoplado ao ecossistema Jitsi |
| SFU próprio (Pion, Go) | Controle total; custo de manutenção alto demais para um projeto voluntário |

## Consequências

- Uma dependência crítica externa. Para mitigar: o Voxa fala com o LiveKit só pelo pacote `@voxa/media` e pelo adaptador `core/voice`, então trocar de SFU seria possível.
- O LiveKit Cloud (comercial) **não** é necessário; tudo roda na própria instância.
- A E2EE com MLS ([Voz §6.8](../06-voz.md#68-criptografia)) exigirá integrar `openmls` à camada de chaves do LiveKit.
