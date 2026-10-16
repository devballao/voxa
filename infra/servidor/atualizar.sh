#!/bin/sh
# Deploy contínuo do Voxa, puxado pelo servidor (ADR 0008).
#
# Roda a cada 5 minutos pelo timer voxa-atualizar (systemd), como o usuário voxa:
#   1. busca a main no GitHub;
#   2. escolhe o commit mais recente da main cujas 4 imagens já estão no GHCR
#      (o workflow Imagens publica sha-<commit> poucos minutos depois do merge);
#   3. se for diferente do que está no ar: troca o código (Compose e configurações)
#      para esse commit, grava VOXA_VERSAO=sha-<commit> no .env e sobe tudo;
#   4. se algum serviço não ficar saudável, volta ao commit anterior e não tenta
#      de novo o mesmo commit.
#
# Para fixar uma versão (e parar de seguir a main): escreva o commit em
# /var/lib/voxa/fixar. Para voltar a seguir a main: apague o arquivo.
# Um commit que falhou fica em /var/lib/voxa/falhou e não é tentado de novo;
# apague esse arquivo para tentar outra vez.
# Logs: journalctl -u voxa-atualizar
set -eu

RAIZ=${VOXA_RAIZ:-/opt/voxa}
ESTADO=${VOXA_ESTADO:-/var/lib/voxa}
COMPOSE="$RAIZ/infra/compose"
SERVICOS="api gateway worker web"
# Quantos commits da main procurar quando os mais novos ainda não têm imagem.
PROCURA=10

cd "$RAIZ"
mkdir -p "$ESTADO"

valor() { sed -n "s/^$1=//p" "$COMPOSE/.env" | tail -n 1; }
IMAGENS=$(valor VOXA_IMAGENS)
IMAGENS=${IMAGENS:-ghcr.io/devballao}

# Verdadeiro se a tag $2 existe para a imagem $1 (registro/caminho). Consulta só o
# manifesto pela API de registro (Docker Registry v2), com token anônimo se o registro
# pedir (como o GHCR para imagens públicas): nada é baixado.
tag_existe() {
  registro=${1%%/*}
  caminho=${1#*/}
  url="https://$registro/v2/$caminho/manifests/$2"
  case $registro in localhost:*) url="http://$registro/v2/$caminho/manifests/$2" ;; esac # registro local de teste
  aceita="Accept: application/vnd.oci.image.index.v1+json, application/vnd.docker.distribution.manifest.list.v2+json, application/vnd.oci.image.manifest.v1+json, application/vnd.docker.distribution.manifest.v2+json"
  codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -I -H "$aceita" "$url")
  if [ "$codigo" = 401 ]; then
    autenticacao=$(curl -s --max-time 15 -I -H "$aceita" "$url" | tr -d '\r' | grep -i '^www-authenticate:')
    realm=$(echo "$autenticacao" | sed -n 's/.*realm="\([^"]*\)".*/\1/p')
    servico=$(echo "$autenticacao" | sed -n 's/.*service="\([^"]*\)".*/\1/p')
    token=$(curl -fsS --max-time 15 "$realm?service=$servico&scope=repository:$caminho:pull" |
      sed -n 's/.*"token":"\([^"]*\)".*/\1/p') || return 1
    codigo=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 -I -H "$aceita" \
      -H "Authorization: Bearer $token" "$url")
  fi
  [ "$codigo" = 200 ]
}

# Verdadeiro se as imagens dos 4 serviços existem no registro para o commit $1.
imagens_prontas() {
  for s in $SERVICOS; do
    tag_existe "$IMAGENS/voxa-$s" "sha-$1" || return 1
  done
}

# Troca o código (Compose e configurações) e a versão das imagens para o commit $1
# e baixa as imagens que faltam. Todas as tags são fixas (versões e sha-<commit>),
# então só o que ainda não está na máquina é baixado.
# Cada passo tem "|| return 1": dentro de um "if", o set -e não vale.
preparar() {
  git -c advice.detachedHead=false checkout --quiet --detach "$1" || return 1
  if grep -q '^VOXA_VERSAO=' "$COMPOSE/.env"; then
    sed -i "s/^VOXA_VERSAO=.*/VOXA_VERSAO=sha-$1/" "$COMPOSE/.env" || return 1
  else
    echo "VOXA_VERSAO=sha-$1" >>"$COMPOSE/.env" || return 1
  fi
  (cd "$COMPOSE" && docker compose pull --policy missing --quiet)
}

# Sobe a versão preparada. Falha se algum serviço não ficar saudável.
subir() {
  (
    cd "$COMPOSE" || exit 1
    # O Garage sobe antes: o bucket e a chave do S3 precisam existir (idempotente).
    docker compose up -d --wait garage || exit 1
    ./scripts/iniciar-garage.sh || exit 1
    docker compose up -d --remove-orphans --wait --wait-timeout 300
  )
}

git fetch --quiet origin main

ATUAL=$(cat "$ESTADO/atual" 2>/dev/null || true)
FALHOU=$(cat "$ESTADO/falhou" 2>/dev/null || true)

if [ -s "$ESTADO/fixar" ]; then
  PEDIDO=$(tr -d ' \n' <"$ESTADO/fixar")
  PEDIDO=${PEDIDO#sha-} # aceita "sha-<commit>", como nas tags
  if ! ALVO=$(git rev-parse --verify --quiet "$PEDIDO^{commit}"); then
    echo "✗ $ESTADO/fixar: commit \"$PEDIDO\" não encontrado." >&2
    exit 1
  fi
  if [ "$ALVO" = "$ATUAL" ] || [ "$ALVO" = "$FALHOU" ]; then exit 0; fi
  if ! imagens_prontas "$ALVO"; then
    echo "✗ As imagens sha-$ALVO não estão no registro; nada foi alterado." >&2
    exit 1
  fi
else
  ALVO=""
  for c in $(git rev-list --first-parent --max-count="$PROCURA" origin/main); do
    # Chegou ao que já está no ar: os mais novos ainda não têm imagem.
    if [ "$c" = "$ATUAL" ]; then exit 0; fi
    # Um commit que já falhou é pulado até o próximo merge corrigir.
    if [ "$c" != "$FALHOU" ] && imagens_prontas "$c"; then ALVO=$c; break; fi
  done
  if [ -z "$ALVO" ]; then
    echo "✗ Nenhum dos últimos $PROCURA commits da main tem imagens publicadas." >&2
    exit 1
  fi
fi

echo "→ Implantando ${ALVO} (no ar: ${ATUAL:-nenhuma versão})"
if ! preparar "$ALVO"; then
  # Falha de rede ou do registro: nada mudou no ar. Tenta de novo na próxima rodada.
  echo "✗ Não foi possível preparar ${ALVO}; nova tentativa em 5 minutos." >&2
  if [ -n "$ATUAL" ]; then preparar "$ATUAL" >/dev/null 2>&1 || true; fi
  exit 1
fi
if subir; then
  echo "$ALVO" >"$ESTADO/atual"
  echo "✓ No ar: $(git log -1 --format='%h %s' "$ALVO")"
  exit 0
fi

echo "$ALVO" >"$ESTADO/falhou"
echo "✗ ${ALVO} não ficou saudável." >&2
(cd "$COMPOSE" && docker compose ps --all) >&2 || true
if [ -n "$ATUAL" ]; then
  echo "→ Voltando para ${ATUAL}" >&2
  preparar "$ATUAL" && subir && echo "✓ De volta a ${ATUAL}" >&2
fi
exit 1
