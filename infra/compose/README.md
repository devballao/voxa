# Infraestrutura de desenvolvimento

Serviços de apoio do Voxa para rodar localmente com Docker Compose ([`docker-compose.dev.yml`](docker-compose.dev.yml)).

> ⚠️ **Somente desenvolvimento.** Todas as senhas, chaves e segredos aqui são públicos e fixos.
>
> **Produção** é o [`docker-compose.yml`](docker-compose.yml) desta mesma pasta, com segredos gerados por `scripts/gerar-segredos.sh`. Passo a passo em [Infraestrutura §3.6](../../docs/03-infraestrutura.md#36-instalação-nó-único).

## Comandos

Na raiz do repositório:

| Comando | O que faz |
|---|---|
| `pnpm dev:infra` | Sobe os 5 serviços, espera todos ficarem saudáveis e inicializa o Garage (bucket e chave). Pode ser executado várias vezes |
| `pnpm dev:infra:down` | Para os contêineres. **Os dados são mantidos** |
| `pnpm dev:infra:reset` | Para os contêineres e **apaga todos os dados** (volumes) |

Requisitos: Docker com Compose v2. Imagens disponíveis para amd64 e arm64 (Apple Silicon incluído).

As variáveis para as aplicações estão no [`.env.example`](../../.env.example) da raiz: `cp .env.example .env`.

## Serviços, portas e credenciais

Todas as portas são publicadas só em `127.0.0.1`: nada fica exposto na rede local.

| Serviço | Imagem | Porta(s) no host | Credenciais de dev |
|---|---|---|---|
| PostgreSQL | `postgres:17.11-alpine` | `5432` | usuário `voxa`, senha `voxa`, banco `voxa` |
| Valkey | `valkey/valkey:8.1.10-alpine` | `6379` | sem senha |
| Garage (S3) | `dxflrs/garage:v2.4.1` | `3900` (S3), `3903` (admin) | bucket `voxa-dev`; chave e segredo em `.env.example`; região `garage` |
| LiveKit | `livekit/livekit-server:v1.13.7` | `7880` (HTTP/WS), `7881/tcp` (ICE), `7882/udp` (mídia) | chave `voxa-dev-key`; segredo em [`config/livekit.dev.yaml`](config/livekit.dev.yaml) |
| Mailpit | `axllent/mailpit:v1.31.3` | `1025` (SMTP), `8025` (web) | aceita qualquer login SMTP |

## Como acessar cada serviço

Não é preciso instalar clientes no host: os exemplos usam os contêineres.

```bash
C="docker compose -f infra/compose/docker-compose.dev.yml"

# PostgreSQL
$C exec postgres psql -U voxa

# Valkey
$C exec valkey valkey-cli ping

# Garage (S3) com a AWS CLI
docker run --rm --network host \
  -e AWS_ACCESS_KEY_ID=GK766f78612d6465762d6b6579 \
  -e AWS_SECRET_ACCESS_KEY=766f78612d6465762d7365637265742d6170656e61732d706172612d6465763031 \
  -e AWS_DEFAULT_REGION=garage \
  amazon/aws-cli:2.37.8 --endpoint-url http://localhost:3900 s3 ls s3://voxa-dev

# Garage: estado do nó e buckets
$C exec garage /garage status
$C exec garage /garage bucket list

# LiveKit: deve responder "OK"
curl http://localhost:7880

# Mailpit: abra http://localhost:8025 no navegador
```

> `--network host` funciona no Linux e no Codespaces. No Docker Desktop (macOS/Windows), troque `localhost` por `host.docker.internal` no `--endpoint-url`.

## Solução de problemas

### Porta ocupada (`address already in use`)

Outro programa já usa a porta, normalmente um Postgres ou Redis instalado no sistema.

```bash
# Linux/macOS: descubra quem está usando a porta
sudo lsof -i :5432          # ou: ss -ltnp | grep 5432
# Windows (PowerShell)
Get-NetTCPConnection -LocalPort 5432 | Select-Object OwningProcess
```

Pare o serviço local (ex.: `sudo systemctl stop postgresql`) e rode `pnpm dev:infra` de novo.

### "O Docker não está respondendo"

Inicie o Docker Desktop (ou `sudo systemctl start docker` no Linux) e tente de novo.

### Algum serviço não fica saudável

```bash
docker compose -f infra/compose/docker-compose.dev.yml ps
docker compose -f infra/compose/docker-compose.dev.yml logs <serviço>
```

Se os dados ficarem inconsistentes (ex.: depois de trocar versões de imagem), `pnpm dev:infra:reset && pnpm dev:infra` recomeça do zero.

### Voz e vídeo no GitHub Codespaces

O Codespaces encaminha só portas **TCP**. A mídia UDP (`7882/udp`) não chega de fora.

- **Esperado (ainda não validado):** com as portas `7880` e `7881` encaminhadas, o navegador deve conseguir mídia por ICE/TCP, que é mais lento que UDP mas suficiente para testes entre abas. Será verificado quando houver cliente de voz (MVP).
- **Não funciona:** conectar um celular ou outro computador ao LiveKit do Codespace.
- Para testes de voz confiáveis e com vários dispositivos, rode o ambiente **localmente** na sua máquina.

### Aviso "UDP receive buffer is too small" nos logs do LiveKit

É esperado em desenvolvimento e pode ser ignorado. Em produção, o buffer é ajustado no host (ver [Infraestrutura](../../docs/03-infraestrutura.md)).

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `docker-compose.dev.yml` | Definição dos serviços, healthchecks e volumes |
| `config/garage.toml` | Configuração do Garage (nó único, SQLite) |
| `config/livekit.dev.yaml` | Configuração do LiveKit (porta UDP única, IP anunciado `127.0.0.1`) |
| `scripts/dev-infra.mjs` | Script usado por `pnpm dev:infra*` (em Node, para funcionar também no Windows) |
