# 0008 — Deploy contínuo puxado pelo servidor

- Status: Proposto
- Data: 2026-10-16

## Contexto

A primeira instância do projeto (Oracle Cloud *Always Free*, [#47](https://github.com/devballao/voxa/issues/47)) deve receber cada merge na `main` sem passo manual, para que cada funcionalidade possa ser acompanhada num endereço real. O CI já publica as imagens `sha-<commit>` no GHCR a cada merge ([#45](https://github.com/devballao/voxa/issues/45)).

## Decisão

O **servidor puxa** as versões novas. Um *timer* do systemd roda [`infra/servidor/atualizar.sh`](../../infra/servidor/atualizar.sh) a cada 5 minutos, que:

1. busca a `main` no GitHub e escolhe o commit mais recente cujas 4 imagens já estão no GHCR;
2. troca o código do servidor (Compose e configurações) para esse commit e fixa `VOXA_VERSAO=sha-<commit>`: código e imagens sempre da mesma versão;
3. sobe tudo e espera os *healthchecks*;
4. se algo não ficar saudável, volta sozinho ao commit anterior e não tenta de novo o commit com problema.

Para fixar uma versão, escreve-se o commit em `/var/lib/voxa/fixar` no servidor.

## Alternativas consideradas

- **O GitHub Actions empurra por SSH:** o deploy é imediato, mas uma chave com acesso ao servidor fica nos *secrets* do GitHub, e o servidor precisa aceitar SSH de qualquer IP, já que os runners não têm IP fixo.
- **Watchtower:** atualiza as imagens, mas não o Compose nem as configurações, que mudam junto com o código. Também não volta sozinho em caso de falha.
- **Usar a tag `main` em vez de `sha-<commit>`:** não diz qual commit está no ar e não permite voltar para uma versão exata.

## Consequências

- Nenhuma credencial do servidor sai dele. O GitHub não tem acesso à máquina, e as imagens e o repositório são públicos.
- Um merge chega à produção em até ~10 minutos (o tempo de publicar as imagens mais o intervalo do *timer*), não na hora.
- Quem pode fazer merge na `main` decide o que roda em produção. A proteção é a revisão dos PRs, como em qualquer deploy contínuo.
- Migrações precisam continuar **compatíveis com a versão anterior** ([Infraestrutura §3.6](../03-infraestrutura.md#atualização)), porque a volta automática não desfaz migrações.
- Serve para qualquer instância. Um administrador pode adotar o mesmo *timer* ou fixar uma versão e atualizar à mão.
