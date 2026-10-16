# Registro de decisões de arquitetura (ADRs)

Cada ADR registra **uma** decisão: o contexto, a escolha e as consequências. ADRs não são editados depois de aceitos; para mudar uma decisão, cria-se um novo ADR que **substitui** o anterior.

| # | Decisão | Status |
|---|---|---|
| [0001](0001-licenca.md) | Licença do projeto | Aceito |
| [0002](0002-typescript-monorepo.md) | TypeScript em monorepo para backend e cliente | Aceito |
| [0003](0003-livekit-como-sfu.md) | LiveKit como servidor de mídia (SFU) | Proposto (confirmação no Milestone 5) |
| [0004](0004-postgres-e-valkey.md) | PostgreSQL como fonte da verdade e Valkey para estado efêmero | Aceito |
| [0005](0005-armazenamento-s3.md) | Armazenamento de arquivos compatível com S3 | Aceito |
| [0006](0006-cliente-react-tauri.md) | React no web e Tauri no desktop | Aceito (web); Proposto (desktop) |
| [0007](0007-implantacao.md) | Docker Compose como padrão, Kubernetes opcional | Proposto (validação no Milestone 2) |

## Modelo

```markdown
# NNNN — Título

- Status: Proposto | Aceito | Substituído por NNNN
- Data: AAAA-MM-DD

## Contexto
O problema e as restrições.

## Decisão
O que foi escolhido.

## Alternativas consideradas
O que mais foi avaliado e por que não.

## Consequências
O que fica mais fácil, o que fica mais difícil, os riscos.
```
