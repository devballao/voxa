#!/bin/sh
# Prepara o armazenamento S3 (Garage) da instância: layout do nó, chave de acesso e bucket.
# Idempotente: pode rodar de novo sem problema. Precisa do Garage no ar (docker compose up -d).
set -eu
cd "$(dirname "$0")/.."

# Lê só as variáveis necessárias do .env (sem executar o arquivo).
valor() { sed -n "s/^$1=//p" .env | tail -n 1; }
CHAVE=$(valor S3_ACCESS_KEY_ID)
SEGREDO=$(valor S3_SECRET_ACCESS_KEY)
BUCKET=$(valor S3_BUCKET)
BUCKET=${BUCKET:-voxa}

# RUST_LOG=warn: sem as mensagens de conexão do cliente do Garage.
garage() { docker compose exec -T -e RUST_LOG=warn garage /garage "$@"; }

if garage layout show 2>/dev/null | grep -q "Current cluster layout version: 0"; then
  NO=$(garage node id -q | cut -d@ -f1)
  garage layout assign -z dc1 -c 10G "$NO" >/dev/null
  garage layout apply --version 1 >/dev/null
  echo "• Garage: layout criado"
fi

if ! garage key info "$CHAVE" >/dev/null 2>&1; then
  garage key import --yes -n voxa "$CHAVE" "$SEGREDO" >/dev/null
  echo "• Garage: chave de acesso importada"
fi

if ! garage bucket info "$BUCKET" >/dev/null 2>&1; then
  garage bucket create "$BUCKET" >/dev/null
  echo "• Garage: bucket \"$BUCKET\" criado"
fi

garage bucket allow --read --write --owner "$BUCKET" --key "$CHAVE" >/dev/null
echo "✓ Armazenamento S3 pronto."
