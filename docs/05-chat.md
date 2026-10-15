# 5. Chat

## 5.1 Princípios

1. **Envio por HTTPS, recebimento pelo gateway.** O envio tem resposta clara (sucesso, erro, limite), e o recebimento chega em tempo real.
2. **Atualização otimista.** A mensagem aparece na hora, marcada como "enviando".
3. **Idempotência por `nonce`.** O cliente gera um `nonce` único; reenvios com o mesmo `nonce` não criam duplicatas, e o evento recebido pelo gateway substitui a mensagem provisória.
4. **Ordem pelo `id` (Snowflake)**, atribuído no servidor.

## 5.2 Envio de mensagem

```mermaid
sequenceDiagram
    autonumber
    actor P as Pessoa
    participant C as Cliente
    participant Q as Fila de envio (cliente)
    participant API
    participant DB as Postgres
    participant OB as Outbox worker
    participant KV as Valkey
    participant GW as Gateways
    participant O as Outros clientes

    P->>C: digita e envia
    C->>C: nonce = snowflake local
    C->>C: mostra mensagem "enviando" (otimista)
    C->>Q: enfileira
    Q->>API: POST /channels/{id}/messages { content, nonce }
    API->>API: autentica, SEND_MESSAGES, slowmode, rate limit, tamanho
    API->>DB: transação: INSERT message + INSERT outbox
    API-->>Q: 201 { message }
    Q-->>C: troca a provisória pela definitiva
    OB->>DB: lê outbox
    OB->>KV: PUBLISH ch:{id} MESSAGE_CREATE
    KV-->>GW: evento
    GW-->>O: DISPATCH MESSAGE_CREATE (filtrado por VIEW_CHANNEL)
    GW-->>C: DISPATCH MESSAGE_CREATE (mesmo nonce → ignorado)
```

### Falhas

| Situação | Comportamento do cliente |
|---|---|
| Sem rede | Mantém na fila local e envia quando a conexão volta (mesmo `nonce`) |
| `429` | Espera `Retry-After` e reenvia |
| `4xx` de validação/permissão | Marca como "falhou" com motivo; opção de editar ou descartar |
| `5xx` / timeout | Até 3 tentativas com backoff exponencial; depois "falhou — tentar de novo" |
| Resposta perdida, mas gravou | O reenvio com o mesmo `nonce` devolve a mensagem já existente (`200`) |

A deduplicação no servidor usa um índice único parcial `(author_id, nonce)` com janela de 24 h (ou chave no Valkey com TTL).

## 5.3 Histórico e paginação

```mermaid
sequenceDiagram
    participant C as Cliente
    participant API
    participant DB as Postgres
    C->>API: GET /channels/{id}/messages?limit=50
    API->>DB: WHERE channel_id=$1 ORDER BY id DESC LIMIT 50
    API-->>C: 50 mais recentes
    Note over C: rolou para cima
    C->>API: GET …?before={id_mais_antigo}&limit=50
    API-->>C: próximas 50
    Note over C: voltou após ficar offline
    C->>API: GET …?after={ultimo_id_visto}&limit=100
```

- A lista no cliente é **virtualizada** (renderiza só o que está visível).
- O cliente guarda em cache (IndexedDB) as últimas mensagens dos canais recentes para abrir instantaneamente.
- Pular para uma mensagem (resposta, link, busca) usa `?around={id}`.

## 5.4 Estado de leitura e menções

- Para cada `(user, channel)` guardamos `last_read_message_id` (Postgres, com escrita agregada a cada poucos segundos).
- Canal não lido = `channel.last_message_id > last_read_message_id`.
- Menções (`@pessoa`, `@cargo`, `@todos`) são extraídas no envio e geram contadores de menção e notificações push para quem está offline.

## 5.5 Edição, exclusão, reações, digitação

| Ação | Endpoint | Evento |
|---|---|---|
| Editar | `PATCH /channels/{c}/messages/{m}` (só autor) | `MESSAGE_UPDATE` com `edited_at` |
| Excluir | `DELETE …/{m}` (autor ou `MANAGE_MESSAGES`) | `MESSAGE_DELETE` — *soft delete*, conteúdo apagado de fato após a janela de auditoria |
| Reagir | `PUT …/{m}/reactions/{emoji}/@me` | `MESSAGE_REACTION_ADD` |
| Digitando | `POST /channels/{c}/typing` (no máximo 1 a cada 8 s) | `TYPING_START` (o cliente esconde após 10 s) |

## 5.6 Anexos

```mermaid
sequenceDiagram
    participant C as Cliente
    participant API
    participant S3
    participant W as Worker media.process
    C->>API: POST /channels/{id}/attachments { filename, size, type }
    API->>API: valida ATTACH_FILES e limite da instância
    API-->>C: { upload_url assinada (PUT, 10 min), attachment_id }
    C->>S3: PUT arquivo (direto, sem passar pela API)
    C->>API: POST /channels/{id}/messages { content, attachments:[attachment_id], nonce }
    API->>W: enfileira processamento
    W->>S3: lê, valida tipo real, gera miniatura, remove EXIF
    W->>API: atualiza metadados → MESSAGE_UPDATE
```

## 5.7 Busca

- **Fase 1:** busca de texto do próprio Postgres (`tsvector` com dicionário `portuguese` e `simple`), por servidor.
- **Fase 2:** Meilisearch opcional para instâncias grandes, alimentado pela fila `outbox`.
- Filtros: autor, canal, tem anexo, menciona, antes/depois de data.
- A busca **sempre** reaplica `VIEW_CHANNEL` e `READ_HISTORY` antes de devolver resultados.
