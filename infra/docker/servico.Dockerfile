# syntax=docker/dockerfile:1
# Imagem de produção de um serviço Node do Voxa (API, gateway ou worker).
#
#   docker build -f infra/docker/servico.Dockerfile \
#     --build-arg PACOTE=@voxa/api --build-arg PORTA_SAUDE=3000 --build-arg CAMINHO_SAUDE=/api/v1/health .
#
# Etapas: (1) `turbo prune` separa só o que o pacote usa; (2) instala e compila;
# (3) `pnpm deploy` monta uma pasta com o pacote e as dependências de produção;
# (4) a imagem final leva só essa pasta e o Node.

ARG NODE_IMAGE=node:24.21.0-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
RUN corepack enable
WORKDIR /repo

FROM base AS poda
ARG PACOTE
COPY . .
RUN pnpm dlx turbo@2.11.6 prune "${PACOTE}" --docker

FROM base AS build
ARG PACOTE
COPY --from=poda /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=poda /repo/out/full/ .
RUN pnpm exec turbo run build --filter="${PACOTE}"
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm --filter "${PACOTE}" deploy --prod /app

FROM ${NODE_IMAGE} AS final
ARG PORTA_SAUDE=""
ARG CAMINHO_SAUDE="/health"
LABEL org.opencontainers.image.source="https://github.com/devballao/voxa" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
# Dentro do contêiner os serviços escutam em todas as interfaces (o padrão local é 127.0.0.1).
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    GATEWAY_HOST=0.0.0.0 \
    VOXA_SAUDE_URL="${PORTA_SAUDE:+http://127.0.0.1:${PORTA_SAUDE}${CAMINHO_SAUDE}}"
WORKDIR /app
COPY --from=build --chown=node:node /app .
COPY --chown=node:node infra/docker/saude.mjs /saude.mjs
USER node
# Sem VOXA_SAUDE_URL (worker, que não tem HTTP), a verificação só confirma que o processo responde.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 CMD ["node", "/saude.mjs"]
CMD ["node", "dist/main.js"]
