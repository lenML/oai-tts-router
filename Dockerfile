#
# Production multi-stage Dockerfile.
#
# Build with:  docker build -t oai-tts-router .
# Run with:    docker run -p 3000:3000 oai-tts-router
#

# ── Base image ─────────────────────────────────────────────────
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ── Dependencies (dev + prod) ──────────────────────────────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
RUN pnpm install --frozen-lockfile

# ── Build ──────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build
RUN pnpm install --prod --frozen-lockfile

# ── Production ─────────────────────────────────────────────────
FROM base
ENV NODE_ENV=production

# cuimp (openai-fm provider) needs bash for curl-impersonate wrapper scripts
RUN apk add --no-cache bash

# Create models directory for runtime persistence
RUN mkdir -p /app/models

COPY --from=build /app/dist    ./dist
COPY --from=build /app/playground ./playground
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

EXPOSE 3000
VOLUME /app/models

CMD ["node", "dist/main.js"]
