# Como contribuir com o Voxa

Obrigado pelo interesse! O Voxa é feito por voluntários, e toda contribuição conta: código, design, tradução, documentação, testes, triagem de issues e divulgação.

## Antes de começar

1. Leia a [visão geral](docs/01-visao-geral.md) e a [arquitetura](docs/02-arquitetura.md).
2. Procure issues com os rótulos `boa primeira issue` ou `ajuda bem-vinda`.
3. Para mudanças grandes, abra uma issue de `proposta` antes de escrever código. Isso evita trabalho perdido.

## Fluxo

1. Faça um fork e crie uma branch: `feat/nome-curto` ou `fix/nome-curto`.
2. Configure o ambiente seguindo [Desenvolvimento](docs/10-desenvolvimento.md#102-ambiente-local).
3. Faça commits no padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/), assinados com DCO (`git commit -s`).
4. Antes de abrir o PR, rode `pnpm lint && pnpm typecheck && pnpm test:unit`. Se mexeu em banco, API ou outro código com testes de integração, rode também `pnpm dev:infra && pnpm test:integration` ([como funcionam os testes](docs/10-desenvolvimento.md#como-rodar-e-adicionar-testes)).
5. Abra o PR descrevendo **o problema**, **a solução** e **como testar**. Se mudou um fluxo, atualize o diagrama em `docs/`.

## Outras formas de ajudar

- **Tradução:** pelo Weblate do projeto (link no README quando estiver no ar).
- **Design e acessibilidade:** issues com o rótulo `design` ou `acessibilidade`.
- **Hospedagem:** teste a instalação em [Infraestrutura](docs/03-infraestrutura.md) e reporte o que não ficou claro.
- **Segurança:** **não** abra issue pública. Siga o [`SECURITY.md`](SECURITY.md).

## Licença e DCO

O Voxa usa licenças diferentes por parte do código ([ADR-0001](docs/adr/0001-licenca.md)):

| Parte | Licença |
|---|---|
| Servidor (`services/`, `packages/core`, `packages/db`) e apps (`apps/`) | [AGPL-3.0-or-later](LICENSE) |
| Bibliotecas de cliente e protocolo (`packages/protocol` e, no futuro, `client-core`, `media`, `ui`) e `packages/config` | [Apache-2.0](LICENSES/Apache-2.0.txt) |
| Documentação (`docs/`) | [CC BY-SA 4.0](LICENSES/CC-BY-SA-4.0.txt) |

Ao contribuir, você licencia a sua contribuição nos mesmos termos da parte que alterou.

Não pedimos que você ceda direitos autorais (CLA). Em vez disso, cada commit leva uma assinatura do **[Developer Certificate of Origin](https://developercertificate.org/)** (DCO): uma declaração de que você tem o direito de enviar aquele código sob a licença do projeto. Basta usar `-s` no commit:

```bash
git commit -s -m "feat(api): …"
```

Isso acrescenta a linha `Signed-off-by: Seu Nome <seu@email>`, com o nome e o e-mail da sua configuração do Git. Esqueceu? `git commit --amend -s` assina o último commit.

## Conduta

Esperamos um ambiente acolhedor e respeitoso. Toda participação no projeto segue o [código de conduta](CODE_OF_CONDUCT.md), adaptado do Contributor Covenant 2.1.
