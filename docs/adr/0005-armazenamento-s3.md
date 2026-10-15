# 0005 — Armazenamento de arquivos compatível com S3

- Status: Proposto
- Data: 2026-10-15

## Contexto

Anexos, avatares e emojis precisam de armazenamento barato, replicável e servido sem passar pela API.

## Decisão

- Interface **S3** (assinatura v4, URLs pré-assinadas para upload e download).
- Upload direto do cliente para o S3; a API só emite a URL e registra os metadados.
- Arquivos públicos (avatares) servidos por `cdn.<domínio>` com cache longo; anexos de canais privados via URL assinada de curta duração.
- Backend padrão no Compose: **Garage** (AGPL-3.0, leve, feito para auto-hospedagem). Também funciona com SeaweedFS, MinIO ou qualquer provedor S3.

## Consequências

- Instâncias podem trocar de backend de armazenamento só mudando a configuração.
- É preciso um worker para limpar uploads órfãos (URL emitida, mas mensagem nunca enviada).
