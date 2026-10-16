#!/bin/sh
# Cria infra/compose/.env a partir do .env.production.example, com segredos novos e aleatórios.
# Não sobrescreve um .env existente (os dados já gravados dependem desses segredos).
set -eu
cd "$(dirname "$0")/.."

if [ -e .env ]; then
  echo "✗ .env já existe. Ele não será sobrescrito: os dados da instância dependem destes segredos." >&2
  exit 1
fi

# n bytes aleatórios em hexadecimal (2n caracteres), sem depender do openssl.
hex() { head -c "$1" /dev/urandom | od -An -tx1 | tr -d ' \n'; }

POSTGRES_PASSWORD=$(hex 24)
VALKEY_PASSWORD=$(hex 24)
GARAGE_RPC_SECRET=$(hex 32)
GARAGE_ADMIN_TOKEN=$(hex 32)
GARAGE_METRICS_TOKEN=$(hex 32)
S3_ACCESS_KEY_ID="GK$(hex 12)"          # formato exigido pelo Garage: GK + 24 hex
S3_SECRET_ACCESS_KEY=$(hex 32)
LIVEKIT_API_KEY="voxa$(hex 6)"
LIVEKIT_API_SECRET=$(hex 32)

umask 077 # o .env fica legível só pelo dono
sed \
  -e "s/^POSTGRES_PASSWORD=$/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" \
  -e "s/^VALKEY_PASSWORD=$/VALKEY_PASSWORD=$VALKEY_PASSWORD/" \
  -e "s/^GARAGE_RPC_SECRET=$/GARAGE_RPC_SECRET=$GARAGE_RPC_SECRET/" \
  -e "s/^GARAGE_ADMIN_TOKEN=$/GARAGE_ADMIN_TOKEN=$GARAGE_ADMIN_TOKEN/" \
  -e "s/^GARAGE_METRICS_TOKEN=$/GARAGE_METRICS_TOKEN=$GARAGE_METRICS_TOKEN/" \
  -e "s/^S3_ACCESS_KEY_ID=$/S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID/" \
  -e "s/^S3_SECRET_ACCESS_KEY=$/S3_SECRET_ACCESS_KEY=$S3_SECRET_ACCESS_KEY/" \
  -e "s/^LIVEKIT_API_KEY=$/LIVEKIT_API_KEY=$LIVEKIT_API_KEY/" \
  -e "s/^LIVEKIT_API_SECRET=$/LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET/" \
  .env.production.example > .env

SEGREDOS="POSTGRES_PASSWORD|VALKEY_PASSWORD|GARAGE_RPC_SECRET|GARAGE_ADMIN_TOKEN|GARAGE_METRICS_TOKEN|S3_ACCESS_KEY_ID|S3_SECRET_ACCESS_KEY|LIVEKIT_API_KEY|LIVEKIT_API_SECRET"
if grep -qE "^($SEGREDOS)=$" .env; then
  echo "✗ Algum segredo não foi gerado. Confira o .env." >&2
  exit 1
fi
echo "✓ .env criado com segredos novos (permissão 600)."
echo "  Agora preencha VOXA_DOMINIO, VOXA_EMAIL_ACME e VOXA_IP_PUBLICO no .env e rode: docker compose up -d"
