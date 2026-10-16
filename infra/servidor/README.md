# Servidor de produção

Scripts para pôr o Voxa no ar num servidor **Ubuntu 24.04** e mantê-lo atualizado a cada merge na `main` ([ADR 0008](../../docs/adr/0008-deploy-puxado-pelo-servidor.md)).

| Arquivo | O que faz |
|---|---|
| [`preparar.sh`](preparar.sh) | Roda uma vez, como root. Instala Docker, Compose e Git, liga as atualizações automáticas de segurança, deixa o SSH só com chave, ajusta os buffers de UDP e o firewall, cria o usuário `voxa` com o repositório em `/opt/voxa`, gera o `.env` com segredos novos e liga o deploy contínuo. Pode rodar de novo sem problema |
| [`atualizar.sh`](atualizar.sh) | Roda a cada 5 minutos pelo timer, como o usuário `voxa`. Põe no ar o commit mais recente da `main` que já tem imagens publicadas e volta sozinho à versão anterior se algo não ficar saudável |
| [`systemd/`](systemd) | O serviço e o timer `voxa-atualizar` |

## Instância do projeto: Oracle Cloud *Always Free*

Máquina ARM gratuita (até 4 núcleos e 24 GB), com o subdomínio gratuito do [DuckDNS](https://www.duckdns.org) até o domínio próprio ([#48](https://github.com/devballao/voxa/issues/48)).

### 1. Criar a máquina

No [painel da Oracle Cloud](https://cloud.oracle.com): **Compute → Instances → Create instance**.

| Campo | Valor |
|---|---|
| Name | `voxa` |
| Image | **Canonical Ubuntu 24.04** (botão *Change image*). Não use a versão *Minimal* |
| Shape | *Change shape* → **Ampere** → `VM.Standard.A1.Flex`, **4 OCPUs** e **24 GB** de memória |
| Networking | Crie uma VCN nova, com **subnet pública** e *Assign a public IPv4 address* marcado |
| SSH keys | **Generate a key pair for me** → baixe a **chave privada** e guarde bem: é o único jeito de entrar na máquina |
| Boot volume | Pode deixar o padrão (cerca de 47 GB; o *Always Free* permite até 200 GB no total) |

> Se aparecer **"Out of capacity"**, a região está sem máquinas ARM livres no momento. Tente outro *Availability domain* ou repita mais tarde. É comum, e a máquina sai em algum momento.

Depois de criada, anote o **Public IP address** na página da instância.

### 2. Liberar as portas na rede da Oracle

Na página da instância: **Subnet** → **Security Lists** → *Default Security List* → **Add Ingress Rules**. Uma regra para cada linha, todas com *Source CIDR* `0.0.0.0/0`:

| Protocolo | Porta de destino | Para quê |
|---|---|---|
| TCP | `80` | HTTP (certificado e redirecionamento para HTTPS) |
| TCP | `443` | HTTPS |
| UDP | `443` | HTTP/3 |
| TCP | `7881` | Voz e vídeo por TCP (redes que bloqueiam UDP) |
| UDP | `7882` | Voz e vídeo |

O firewall *dentro* da máquina, que também bloqueia essas portas nas imagens da Oracle, é ajustado pelo `preparar.sh`.

### 3. Criar o subdomínio

Em [duckdns.org](https://www.duckdns.org), entre com a conta do GitHub ou do Google, crie o subdomínio (ex.: `voxa-teste`) e, no campo **current ip**, coloque o IP público da máquina → **update ip**.

O IP da Oracle não muda enquanto a máquina existir. Por isso, não é preciso atualizar o DuckDNS de tempos em tempos.

### 4. Preparar a máquina e pôr o Voxa no ar

Entre na máquina com a chave baixada (no Windows, pelo PowerShell):

```bash
ssh -i caminho/da/chave.key ubuntu@<IP público>
```

Na máquina:

```bash
curl -fsSLO https://raw.githubusercontent.com/devballao/voxa/main/infra/servidor/preparar.sh
less preparar.sh   # leia antes de rodar como root
sudo sh preparar.sh voxa-teste.duckdns.org voxa.projeto@gmail.com
```

O primeiro deploy baixa as imagens e leva alguns minutos. No fim, `https://voxa-teste.duckdns.org` mostra a página de status. O e-mail é o que recebe os avisos do Let's Encrypt sobre o certificado HTTPS.

## Operação

Entre na máquina com `ssh` (como acima) e use os comandos abaixo.

| Para | Comando |
|---|---|
| Ver o que está no ar | `cat /var/lib/voxa/atual` |
| Acompanhar o deploy | `journalctl -u voxa-atualizar -f` |
| Ver os deploys anteriores | `journalctl -u voxa-atualizar --since "1 day ago"` |
| Forçar uma verificação agora | `sudo systemctl start voxa-atualizar` |
| Estado dos serviços | `cd /opt/voxa/infra/compose && sudo -u voxa docker compose ps` |
| Logs de um serviço | `cd /opt/voxa/infra/compose && sudo -u voxa docker compose logs -f --tail 100 api` |
| Reiniciar um serviço | `cd /opt/voxa/infra/compose && sudo -u voxa docker compose restart api` |
| Pausar o deploy contínuo | `sudo systemctl stop voxa-atualizar.timer` (volta com `start`) |

### Voltar a uma versão anterior

```bash
echo <commit> | sudo -u voxa tee /var/lib/voxa/fixar   # ex.: 0d2ca07
sudo systemctl start voxa-atualizar
```

O commit fica fixado e as novas versões da `main` são ignoradas. Para voltar a seguir a `main`, apague o arquivo com `sudo rm /var/lib/voxa/fixar`.

Quando uma versão não fica saudável, o servidor volta sozinho para a anterior e anota o commit em `/var/lib/voxa/falhou`. Esse commit não é tentado de novo, e o próximo merge segue normalmente. Para tentar de novo o mesmo commit, apague o arquivo.

### Segredos

Ficam só em `/opt/voxa/infra/compose/.env`, que só o usuário `voxa` pode ler (permissão 600). **Faça uma cópia desse arquivo fora do servidor.** Sem ele, os dados gravados (banco e arquivos) ficam inacessíveis.

### Atualizações do sistema

As correções de segurança do Ubuntu, incluindo as do Docker, são instaladas sozinhas. Se alguma pedir reinício, a máquina reinicia às 04:30 UTC (01:30 em Brasília), e os serviços voltam sozinhos.

## O que o `preparar.sh` muda na máquina

- Pacotes `docker.io`, `docker-compose-v2`, `git`, `curl` e `unattended-upgrades`, e um `apt upgrade` completo.
- `/etc/apt/apt.conf.d/52voxa-atualizacoes`: atualizações automáticas e reinício às 04:30 UTC, se preciso.
- `/etc/ssh/sshd_config.d/60-voxa.conf`: sem login por senha e sem login de root.
- `/etc/sysctl.d/60-voxa.conf`: buffers de UDP maiores (mídia do LiveKit e HTTP/3).
- `/etc/iptables/rules.v4` (só nas imagens da Oracle): aceita 80, 443, 7881/tcp e 7882/udp antes da regra que recusa o resto.
- Usuário `voxa`, sem senha e no grupo `docker`, o que dá a ele o mesmo poder do root na máquina. Repositório em `/opt/voxa`, estado do deploy em `/var/lib/voxa`.
- `/etc/systemd/system/voxa-atualizar.{service,timer}`.
