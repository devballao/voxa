# 0002 — TypeScript em monorepo para backend e cliente

- Status: Proposto
- Data: 2026-10-15

## Contexto

O projeto depende de pessoas voluntárias. A barreira de entrada precisa ser baixa, e o protocolo entre cliente e servidor deve ser verificado pelo compilador.

## Decisão

- TypeScript estrito em backend (Node.js 24 LTS + Fastify) e cliente (React).
- Monorepo com pnpm workspaces + Turborepo.
- Esquemas **Zod** em `@voxa/protocol`, que são a fonte única da verdade para validação, tipos e OpenAPI.

## Alternativas consideradas

| Opção | Avaliação |
|---|---|
| Go no backend | Ótimo desempenho e concorrência; separa o protocolo em duas linguagens e reduz o público que contribui para o todo |
| Elixir/Phoenix no gateway | Excelente para muitas conexões; curva de aprendizado alta e comunidade menor |
| Rust no backend | Desempenho máximo; produtividade e acesso de iniciantes menores |

## Consequências

- Um único conjunto de ferramentas; refatorações do protocolo quebram a compilação dos dois lados.
- Se o gateway virar gargalo, ele pode ser reescrito (ex.: Go ou Elixir) **sem mudar o protocolo**, porque o contrato está em `@voxa/protocol` e a comunicação interna é via Valkey.
- A mídia pesada não roda em Node: fica no LiveKit ([0003](0003-livekit-como-sfu.md)).
