# 2. Arquitetura

> Status: **Proposta v0.1** — as escolhas de tecnologia estão registradas nos [ADRs](adr/README.md).

## 2.1 Contexto

Quem interage com o Voxa e com quais sistemas externos ele conversa.

```mermaid
flowchart TB
    U(["Participante<br/>navegador, desktop, mobile"])
    M(["Moderação"])
    A(["Admin da instância"])
    B(["Bots / integrações"])

    V["Instância Voxa"]

    E1[("Provedor de e-mail<br/>SMTP")]
    E2[("Provedor de identidade<br/>OIDC opcional")]
    E3[("Push<br/>Web Push / UnifiedPush / FCM / APNs")]

    U -- "HTTPS, WSS, WebRTC" --> V
    M -- "HTTPS" --> V
    A -- "SSH, painel admin, métricas" --> V
    B -- "API REST + gateway" --> V
    V -- "verificação de conta, recuperação" --> E1
    V -- "login federado" --> E2
    V -- "notificações" --> E3
```

## 2.2 Contêineres (serviços)

```mermaid
flowchart LR
    subgraph Clientes
        W["App web<br/>React + Vite"]
        D["App desktop<br/>Tauri"]
        MO["App mobile<br/>roadmap"]
    end

    subgraph Borda
        RP["Proxy reverso<br/>Caddy: TLS, HTTP/3"]
    end

    subgraph Aplicação
        API["API<br/>REST, Fastify"]
        GW["Gateway<br/>WebSocket"]
        WK["Workers<br/>filas: e-mail, mídia, push"]
    end

    subgraph Mídia
        SFU["SFU<br/>LiveKit"]
        TURN["TURN<br/>embutido no LiveKit ou coturn"]
    end

    subgraph Dados
        PG[("PostgreSQL<br/>dados persistentes")]
        KV[("Valkey<br/>pub/sub, presença, cache, filas")]
        S3[("Armazenamento S3<br/>anexos, avatares")]
        SE[("Busca<br/>Postgres FTS ou Meilisearch")]
    end

    W & D & MO -->|HTTPS| RP
    W & D & MO -->|WSS| RP
    W & D & MO -.->|WebRTC UDP/TCP| SFU
    W & D & MO -.->|fallback| TURN
    RP --> API
    RP --> GW
    RP -->|sinalização WSS| SFU
    RP -->|arquivos| S3

    API --> PG
    API --> KV
    API --> S3
    API -->|emite token de sala| SFU
    GW --> KV
    GW --> PG
    WK --> KV
    WK --> PG
    WK --> S3
    API --> SE
    SFU -->|webhooks: entrou, saiu, publicou| API
```

### Responsabilidades

| Serviço | Faz | Não faz |
|---|---|---|
| **API** | Autenticação, CRUD de servidores/canais/mensagens, permissões, upload assinado, emissão de tokens de mídia | Manter conexões longas |
| **Gateway** | Mantém um WebSocket por sessão; entrega eventos (mensagens, presença, estado de voz) filtrados por permissão | Escrever no banco (exceto sessão) |
| **Workers** | Tarefas assíncronas: miniaturas, varredura de arquivos, e-mails, push, limpeza | Atender requisições do cliente |
| **SFU (LiveKit)** | Recebe e repassa áudio, vídeo e tela; simulcast; controle de banda; E2EE de quadros | Decidir quem pode entrar (isso vem do token da API) |
| **TURN** | Retransmite mídia quando UDP direto é bloqueado (redes corporativas, CGNAT) | — |
| **PostgreSQL** | Fonte da verdade | — |
| **Valkey** | Barramento de eventos entre API e gateways, presença, estado de voz efêmero, rate limit, filas | Dados que não podem ser perdidos |

## 2.3 Princípio central: três planos separados

```mermaid
flowchart TB
    subgraph P1["Plano de controle — HTTPS"]
        direction LR
        c1["login"] --- c2["criar canal"] --- c3["enviar mensagem"] --- c4["pedir token de voz"]
    end
    subgraph P2["Plano de eventos — WebSocket"]
        direction LR
        e1["MESSAGE_CREATE"] --- e2["PRESENCE_UPDATE"] --- e3["VOICE_STATE_UPDATE"] --- e4["TYPING_START"]
    end
    subgraph P3["Plano de mídia — WebRTC"]
        direction LR
        m1["áudio Opus"] --- m2["vídeo VP8/H.264/AV1"] --- m3["tela"]
    end
    P1 -->|"publica eventos no Valkey"| P2
    P1 -->|"token JWT de sala"| P3
    P3 -->|"webhooks"| P1
```

- **Escrita sempre por HTTPS.** O cliente nunca altera estado pelo WebSocket (exceto presença e digitação, que são efêmeros). Isso simplifica autorização, idempotência e testes.
- **Leitura em tempo real pelo gateway.** Toda mudança vira um evento publicado no Valkey; cada gateway entrega somente às sessões interessadas e autorizadas.
- **Mídia direto no SFU.** O tráfego pesado nunca passa pela API nem pelo gateway.

## 2.4 Exemplo de ponta a ponta: entrar numa sala de voz

```mermaid
sequenceDiagram
    autonumber
    participant C as Cliente
    participant API
    participant KV as Valkey
    participant GW as Gateway
    participant SFU as LiveKit

    C->>API: POST /channels/{id}/voice/join
    API->>API: verifica permissão CONNECT
    API->>KV: grava voice_state, publica VOICE_STATE_UPDATE
    API-->>C: { url do SFU, token JWT, opções }
    KV-->>GW: VOICE_STATE_UPDATE
    GW-->>C: evento para todos no servidor
    C->>SFU: conecta WebSocket com token
    C->>SFU: WebRTC: publica microfone
    SFU-->>C: recebe áudio de quem já está na sala
    SFU->>API: webhook participant_joined
```

Detalhes em [Voz](06-voz.md).

## 2.5 Escalabilidade

| Componente | Como escala | Estado |
|---|---|---|
| API | Horizontal, sem estado | Nenhum local |
| Gateway | Horizontal; sessões fixadas por conexão; eventos via Valkey pub/sub | Sessão em memória + `resume` via Valkey |
| Workers | Horizontal por fila | Nenhum local |
| SFU | Múltiplos nós LiveKit com roteamento por sala (Valkey) | Por sala |
| PostgreSQL | Vertical → réplicas de leitura → particionamento de `messages` por canal/tempo | — |
| Valkey | Vertical → Sentinel/cluster | — |

Detalhes e topologias em [Infraestrutura](03-infraestrutura.md).

## 2.6 Tecnologias propostas

| Camada | Escolha | Licença | ADR |
|---|---|---|---|
| Linguagem (backend e cliente) | TypeScript | Apache-2.0 | [0002](adr/0002-typescript-monorepo.md) |
| API | Node.js 24 LTS + Fastify | MIT | [0002](adr/0002-typescript-monorepo.md) |
| Gateway | Node.js + `ws` (ou uWebSockets.js se precisar) | MIT / Apache-2.0 | [0002](adr/0002-typescript-monorepo.md) |
| Mídia | LiveKit Server | Apache-2.0 | [0003](adr/0003-livekit-como-sfu.md) |
| Banco | PostgreSQL 17 | PostgreSQL | [0004](adr/0004-postgres-e-valkey.md) |
| Cache/pub-sub | Valkey 8 | BSD-3 | [0004](adr/0004-postgres-e-valkey.md) |
| Objetos | Qualquer S3 (Garage, SeaweedFS, MinIO, provedor) | — | [0005](adr/0005-armazenamento-s3.md) |
| Web | React 19 + Vite + TanStack Router | MIT | [0006](adr/0006-cliente-react-tauri.md) |
| Desktop | Tauri 2 | MIT / Apache-2.0 | [0006](adr/0006-cliente-react-tauri.md) |
| Proxy | Caddy | Apache-2.0 | [0007](adr/0007-implantacao.md) |
| Observabilidade | Prometheus, Grafana, Loki, OpenTelemetry | Apache-2.0 / AGPL-3.0 | [0007](adr/0007-implantacao.md) |
