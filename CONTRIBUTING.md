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
4. Rode `pnpm lint && pnpm test` antes de abrir o PR.
5. Abra o PR descrevendo **o problema**, **a solução** e **como testar**. Se mudou um fluxo, atualize o diagrama em `docs/`.

## Outras formas de ajudar

- **Tradução:** pelo Weblate do projeto (link no README quando estiver no ar).
- **Design e acessibilidade:** issues com o rótulo `design` ou `acessibilidade`.
- **Hospedagem:** teste a instalação em [Infraestrutura](docs/03-infraestrutura.md) e reporte o que não ficou claro.
- **Segurança:** **não** abra issue pública. Siga o `SECURITY.md`.

## Conduta

Esperamos um ambiente acolhedor e respeitoso. O projeto adotará o [Contributor Covenant 2.1](https://www.contributor-covenant.org/pt-br/version/2/1/code_of_conduct/) como código de conduta (ver [Roadmap — Fase 0](docs/11-roadmap.md#fase-0--fundação)).
