# Cliente. Etapa 1: compila con Vite; etapa 2: Nginx sirve dist/ y pasa /servidor a Colyseus.

FROM node:22.23.3-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/shared/package.json packages/shared/
COPY packages/games/conquian/package.json packages/games/conquian/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile --filter "@cartas/client..." --filter cartas-sv

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/client apps/client
# Vacío: el cliente usa /servidor en el mismo dominio. Se puede apuntar a otro servidor.
ARG VITE_SERVIDOR=
ENV VITE_SERVIDOR=${VITE_SERVIDOR}
RUN pnpm --filter @cartas/client build

FROM nginx:1.30.0-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/client/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=3s --start-period=5s \
  CMD wget -qO- http://localhost/health || exit 1
