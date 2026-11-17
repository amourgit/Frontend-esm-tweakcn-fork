# syntax=docker/dockerfile:1
# EGEN Theme Studio — image de production (Next.js "standalone").
# Build : docker build -t egen-theme-studio:latest --build-arg NEXT_PUBLIC_APP_URL=https://studio.example.org .

ARG NODE_VERSION=22
# Doit rester identique au champ "packageManager" de package.json.
ARG PNPM_VERSION=10.34.9

FROM node:${NODE_VERSION}-alpine AS base
ARG PNPM_VERSION
ENV HUSKY=0 NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat && npm install -g pnpm@${PNPM_VERSION}
WORKDIR /app

# --- Dépendances (couche mise en cache tant que les lockfiles ne changent pas)
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
COPY scripts/require-pnpm.mjs ./scripts/require-pnpm.mjs
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# --- Build
FROM deps AS build
COPY . .
# URL publique du service (inlinée au build : liens de partage, registre shadcn, MCP, script d'aperçu).
ARG NEXT_PUBLIC_APP_URL=""
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
# Valeurs factices : le build n'accède pas à la base et ne conserve aucun secret.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-only" \
    BASE_URL="http://localhost:3000"
RUN pnpm build && pnpm build:tools

# --- Exécution
FROM node:${NODE_VERSION}-alpine AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat && addgroup -S app && adduser -S app -G app
WORKDIR /app

COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
COPY --from=build --chown=app:app /app/drizzle ./drizzle
COPY --from=build --chown=app:app /app/dist/migrate.cjs ./migrate.cjs
COPY --from=build --chown=app:app /app/dist/create-oauth-app.cjs ./create-oauth-app.cjs
COPY --chown=app:app --chmod=755 docker-entrypoint.sh ./docker-entrypoint.sh

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT}/api/health > /dev/null || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
