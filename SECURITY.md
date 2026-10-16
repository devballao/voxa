# Política de segurança

O Voxa lida com conversas, voz e dados pessoais. Levamos vulnerabilidades a sério e agradecemos a quem as relata com responsabilidade.

## Como relatar uma vulnerabilidade

**Não abra uma issue pública.** Uma falha publicada antes da correção coloca em risco todas as instâncias.

Relate em privado pelo GitHub: aba **Security → Report a vulnerability** ([link direto](https://github.com/devballao/voxa/security/advisories/new)). Só a mantenedoria vê o relato.

Inclua, se possível:

- O componente afetado (API, gateway, worker, app web…) e a versão ou o commit
- Os passos para reproduzir e o impacto esperado
- Uma prova de conceito, se houver
- Se quer ser creditado na publicação da correção, e com qual nome

## O que esperar

| Etapa | Prazo |
|---|---|
| Confirmação de recebimento | até 3 dias |
| Avaliação inicial (gravidade e se é reproduzível) | até 7 dias |
| Correção de falhas críticas e altas | o quanto antes, em geral até 30 dias |

O projeto é mantido por voluntários, então os prazos são metas, não garantias. Manteremos você informado durante todo o processo. Depois da correção, publicamos um aviso de segurança (*security advisory*) com o crédito a quem relatou, se a pessoa quiser.

## Versões suportadas

O Voxa está em **pré-alfa**. Só a branch `main` recebe correções de segurança. Esta tabela será atualizada quando houver versões publicadas.

| Versão | Suporte |
|---|---|
| `main` | ✅ |

## Escopo

Estão no escopo falhas no código deste repositório: autenticação e sessões, permissões, gateway, API, workers, app web e configurações de implantação em `infra/`.

Ficam fora do escopo:

- Instâncias de terceiros mal configuradas (relate a quem as administra)
- Ataques de negação de serviço por volume
- Engenharia social e ataques físicos
- Vulnerabilidades em dependências que já tenham correção publicada, mas ainda não atualizada aqui. Essas podem ser relatadas numa issue pública comum

## Boas práticas para quem pesquisa

Teste apenas em instâncias suas, rodando localmente (`pnpm dev`). Não acesse, modifique nem apague dados de outras pessoas e não degrade instâncias públicas.

O modelo de ameaças do projeto está em [Segurança e privacidade](docs/09-seguranca-e-privacidade.md).
