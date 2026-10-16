# 0004 — PostgreSQL como fonte da verdade e Valkey para estado efêmero

- Status: **Aceito**
- Data: 2026-10-15 (proposto) · 2026-10-16 (aceito)
- Implementado: Postgres 17 com Drizzle e migrações ([#7](https://github.com/devballao/voxa/issues/7)); Valkey 8 com pub/sub no gateway e streams no worker ([#9](https://github.com/devballao/voxa/issues/9)) e leases do Snowflake ([#34](https://github.com/devballao/voxa/issues/34)). O particionamento de `messages` e o outbox chegam com as mensagens e as contas, no MVP.

## Contexto

Precisamos de consistência para dados permanentes (contas, permissões, mensagens) e de baixa latência para dados efêmeros e muito voláteis (presença, voz, digitação), além de um barramento de eventos entre processos.

## Decisão

- **PostgreSQL 17**: todos os dados persistentes; `messages` particionada por intervalo de `id`; busca de texto nativa na fase 1.
- **Valkey 8** (fork BSD do Redis, mantido pela Linux Foundation): pub/sub entre API e gateways, presença, estado de voz com TTL, rate limit, buffers de `resume` e filas (streams).
- Eventos publicados via **outbox transacional**, para que nunca se anuncie algo que não foi gravado.

## Alternativas consideradas

| Opção | Avaliação |
|---|---|
| ScyllaDB/Cassandra para mensagens | Escala massiva; operação complexa para instâncias pequenas. Reavaliar se o Postgres particionado não bastar |
| Redis | Mudou para licenças não-OSI em 2024 (voltou a ter opção AGPL em 2025); o Valkey é compatível e com governança aberta |
| NATS / Kafka como barramento | Mais recursos; mais um serviço para operar. NATS pode substituir o pub/sub do Valkey numa fase de escala |

## Consequências

- Uma instância pequena precisa só de dois serviços de dados.
- O Valkey pode ser perdido sem perda de dados permanentes: presença e voz se reconstroem quando os clientes reconectam.
