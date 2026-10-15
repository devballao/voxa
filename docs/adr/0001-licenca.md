# 0001 — Licença do projeto

- Status: **Proposto — requer decisão da mantenedoria**
- Data: 2026-10-15

## Contexto

O Voxa é de código aberto e sem fins lucrativos. Seus componentes principais são serviços de rede. Com uma licença permissiva, uma empresa pode pegar o código, modificá-lo e oferecê-lo como serviço fechado, sem devolver melhorias.

## Decisão (proposta)

- **Servidor** (`services/`, `packages/core`, `packages/db`): **AGPL-3.0-or-later**. Quem oferecer uma versão modificada como serviço precisa publicar as modificações.
- **Bibliotecas de cliente e protocolo** (`packages/protocol`, `packages/client-core`, `packages/media`, `packages/ui`): **Apache-2.0**, para facilitar bots, integrações e clientes alternativos.
- **Apps** (`apps/web`, `apps/desktop`): AGPL-3.0-or-later.
- **Documentação:** CC BY-SA 4.0.

## Alternativas consideradas

| Opção | Por que não (por enquanto) |
|---|---|
| MIT / Apache-2.0 em tudo | Permite forks fechados oferecidos como serviço |
| GPL-3.0 | Não cobre o uso em rede ("brecha SaaS") |
| Licenças "source-available" (BSL, SSPL) | Não são de código aberto segundo a OSI; afastam a comunidade |

## Consequências

- Alinha-se a projetos similares de comunicação livre, como Matrix/Element e Revolt.
- As dependências precisam ser compatíveis (MIT, BSD, Apache-2.0 e LGPL são compatíveis com AGPL).
- Contribuições: recomenda-se **DCO** (`Signed-off-by`) em vez de CLA, para não concentrar direitos.
- **Não é aconselhamento jurídico.** A mantenedoria deve confirmar a escolha antes de criar o arquivo `LICENSE`.
