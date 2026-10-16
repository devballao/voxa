# syntax=docker/dockerfile:1
# Imagem de produção do app web: os arquivos estáticos do Vite servidos pelo Caddy.
#
#   docker build -f infra/docker/web.Dockerfile .
#
# Esta imagem só serve o app (porta 80). HTTPS e o encaminhamento de /api e
# /gateway ficam no Caddy da borda, configurado no Compose de produção.

ARG NODE_IMAGE=node:24.21.0-alpine

FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    TURBO_TELEMETRY_DISABLED=1 \
    DO_NOT_TRACK=1
RUN corepack enable
WORKDIR /repo

FROM base AS poda
COPY . .
RUN pnpm dlx turbo@2.11.6 prune @voxa/web --docker

FROM base AS build
COPY --from=poda /repo/out/json/ .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY --from=poda /repo/out/full/ .
RUN pnpm exec turbo run build --filter=@voxa/web

FROM caddy:2.11.4-alpine AS final
LABEL org.opencontainers.image.source="https://github.com/devballao/voxa" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later"
COPY infra/docker/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /repo/apps/web/dist /srv
HEALTHCHECK --interval=15s --timeout=5s --retries=3 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1/"]
