# Servidor de Colyseus. Etapa 1: compila; etapa 2: solo JS y dependencias de producción.

FROM node:22.23.3-alpine AS build
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

# Primero solo lo que define dependencias, para que la instalación quede en caché.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/shared/package.json packages/shared/
COPY packages/games/conquian/package.json packages/games/conquian/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/
RUN pnpm install --frozen-lockfile --filter "@cartas/server..."

COPY tsconfig.base.json ./
COPY packages packages
COPY apps/server apps/server
# Empaqueta el servidor y el código de los juegos en un solo archivo JS.
RUN pnpm --filter @cartas/server build
# Carpeta con solo las dependencias de producción del servidor.
RUN pnpm --filter @cartas/server deploy --prod /salida \
  && cp -r apps/server/dist /salida/dist

FROM node:22.23.3-alpine
ENV NODE_ENV=production PORT=2567
WORKDIR /app
COPY --from=build --chown=node:node /salida/node_modules ./node_modules
COPY --from=build --chown=node:node /salida/package.json ./
COPY --from=build --chown=node:node /salida/dist ./dist
# Sin privilegios.
USER node
EXPOSE 2567
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s \
  CMD wget -qO- "http://localhost:${PORT}/health" || exit 1
CMD ["node", "--enable-source-maps", "dist/index.js"]
