#!/bin/sh
# Prepara um servidor Ubuntu 24.04 para rodar o Voxa e o põe no ar (docs/03-infraestrutura.md §3.6).
#
#   sudo sh preparar.sh <domínio> <e-mail para o Let's Encrypt>
#
# Idempotente: pode rodar de novo (por exemplo, depois de mudar este script).
#   1. pacotes: Docker e Compose (do Ubuntu), Git, atualizações automáticas de segurança;
#   2. SSH só com chave; buffers de UDP para a mídia;
#   3. firewall da máquina (imagens Ubuntu da Oracle Cloud): portas 80, 443, 7881 e 7882;
#   4. usuário voxa (sem senha) com o repositório em /opt/voxa;
#   5. .env com segredos novos (só na primeira vez);
#   6. timer voxa-atualizar: deploy contínuo a cada merge na main (ADR 0008).
set -eu

REPOSITORIO=${VOXA_REPOSITORIO:-https://github.com/devballao/voxa.git}
RAIZ=/opt/voxa
COMPOSE=$RAIZ/infra/compose

passo() { printf '\n→ %s\n' "$*"; }
falhar() {
  echo "✗ $*" >&2
  exit 1
}

[ "$(id -u)" -eq 0 ] || falhar "Rode com sudo: sudo sh preparar.sh <domínio> <e-mail>"
[ $# -eq 2 ] || falhar "Uso: sudo sh preparar.sh <domínio> <e-mail para o Let's Encrypt>"
DOMINIO=$1
EMAIL=$2
case $DOMINIO in *://* | */*) falhar "Informe só o domínio, sem https:// nem barras (ex.: voxa-teste.duckdns.org)" ;; esac
case $EMAIL in *@*) ;; *) falhar "E-mail inválido: $EMAIL" ;; esac
# shellcheck source=/dev/null
. /etc/os-release
[ "$ID" = ubuntu ] || falhar "Este script é para Ubuntu (encontrado: $PRETTY_NAME)."
[ "$VERSION_ID" = 24.04 ] || echo "⚠ Testado no Ubuntu 24.04; este é o $VERSION_ID."

passo "Pacotes e atualizações do sistema"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -y -q
# Docker e Compose dos repositórios do Ubuntu: recebem as correções de segurança
# pelas atualizações automáticas, como o resto do sistema.
apt-get install -y -q docker.io docker-compose-v2 git curl unattended-upgrades
systemctl enable --now docker

passo "Atualizações automáticas de segurança (reinicia às 04:30 UTC, se preciso)"
cat >/etc/apt/apt.conf.d/52voxa-atualizacoes <<'EOF'
// Criado por infra/servidor/preparar.sh (Voxa).
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF

passo "SSH só com chave e sem login de root"
cat >/etc/ssh/sshd_config.d/60-voxa.conf <<'EOF'
# Criado por infra/servidor/preparar.sh (Voxa).
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
EOF
sshd -t || falhar "Configuração do SSH inválida; nada foi recarregado."
systemctl try-reload-or-restart ssh

passo "Buffers de UDP (mídia do LiveKit e HTTP/3 do Caddy)"
cat >/etc/sysctl.d/60-voxa.conf <<'EOF'
# Criado por infra/servidor/preparar.sh (Voxa).
net.core.rmem_max = 7500000
net.core.wmem_max = 7500000
EOF
sysctl -q --load=/etc/sysctl.d/60-voxa.conf

# As imagens Ubuntu da Oracle Cloud vêm com iptables que recusa tudo além do SSH
# (/etc/iptables/rules.v4). Libera as portas do Voxa antes da regra REJECT, no
# arquivo (vale a partir do próximo boot) e nas regras em uso (vale agora).
# Em outros provedores, o firewall é o da nuvem (security group / firewall do painel).
REGRAS=/etc/iptables/rules.v4
if [ -f "$REGRAS" ] && grep -q '^-A INPUT -j REJECT' "$REGRAS"; then
  passo "Firewall da máquina (iptables da Oracle): 80, 443, 7881/tcp, 443 e 7882/udp"
  for regra in "tcp 80" "tcp 443" "udp 443" "tcp 7881" "udp 7882"; do
    # shellcheck disable=SC2086 # separa protocolo e porta
    set -- $regra
    linha="-A INPUT -p $1 -m state --state NEW -m $1 --dport $2 -j ACCEPT"
    if ! grep -qxF -- "$linha" "$REGRAS"; then
      sed -i "0,/^-A INPUT -j REJECT/s//$linha\n&/" "$REGRAS"
    fi
    if ! iptables -C INPUT -p "$1" -m state --state NEW -m "$1" --dport "$2" -j ACCEPT 2>/dev/null; then
      posicao=$(iptables -L INPUT --line-numbers | awk '/REJECT/ { print $1; exit }')
      iptables -I INPUT "${posicao:-1}" -p "$1" -m state --state NEW -m "$1" --dport "$2" -j ACCEPT
    fi
  done
else
  passo "Firewall: sem iptables da Oracle; libere 80, 443 (TCP e UDP), 7881/tcp e 7882/udp no painel da nuvem"
fi

passo "Usuário voxa e repositório em $RAIZ"
if ! id voxa >/dev/null 2>&1; then
  # Sem senha: só se entra com "sudo -iu voxa". O grupo docker equivale a root na máquina.
  useradd --create-home --shell /bin/bash --groups docker voxa
fi
usermod -aG docker voxa
if [ ! -d "$RAIZ/.git" ]; then
  install -d -o voxa -g voxa "$RAIZ"
  sudo -u voxa git clone --quiet "$REPOSITORIO" "$RAIZ"
fi

if [ ! -f "$COMPOSE/.env" ]; then
  passo "Segredos novos em $COMPOSE/.env"
  sudo -u voxa "$COMPOSE/scripts/gerar-segredos.sh"
fi
# IP público: as máquinas da Oracle só enxergam o IP privado; pergunta a um serviço externo.
IP=$(curl -fsS --max-time 10 https://checkip.amazonaws.com) ||
  falhar "Não foi possível descobrir o IP público do servidor."
IP=$(echo "$IP" | tr -d '[:space:]')
case $IP in *[!0-9.]* | "") falhar "IP público inválido: \"$IP\"" ;; esac
sed -i \
  -e "s|^VOXA_DOMINIO=.*|VOXA_DOMINIO=$DOMINIO|" \
  -e "s|^VOXA_EMAIL_ACME=.*|VOXA_EMAIL_ACME=$EMAIL|" \
  -e "s|^VOXA_IP_PUBLICO=.*|VOXA_IP_PUBLICO=$IP|" \
  "$COMPOSE/.env"
echo "  domínio $DOMINIO, IP público $IP"

passo "Deploy contínuo (timer voxa-atualizar, a cada 5 minutos)"
install -m 644 "$RAIZ/infra/servidor/systemd/voxa-atualizar.service" /etc/systemd/system/
install -m 644 "$RAIZ/infra/servidor/systemd/voxa-atualizar.timer" /etc/systemd/system/
systemctl daemon-reload

passo "Primeiro deploy (baixa as imagens e sobe tudo; leva alguns minutos)"
if ! systemctl start voxa-atualizar.service; then
  journalctl -u voxa-atualizar --no-pager -n 40 >&2
  falhar "O deploy falhou (log acima). Corrija e rode este script de novo."
fi
systemctl enable --now voxa-atualizar.timer

printf '\n✓ Pronto: https://%s\n' "$DOMINIO"
echo "  O certificado HTTPS sai em até 1 minuto, se o domínio já apontar para $IP."
echo "  Logs do deploy: journalctl -u voxa-atualizar -f"
