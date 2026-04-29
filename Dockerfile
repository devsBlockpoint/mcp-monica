# syntax=docker/dockerfile:1.7
# ============================================================================
# mcp-monica — MCP server image
# ============================================================================

# Stage 1: install deps (production only)
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Stage 2: install full deps (incl. tsx) for runtime TS execution
FROM node:20-alpine AS deps-full
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Stage 3: runtime
FROM node:20-alpine AS runtime
WORKDIR /app

# wget para el healthcheck (alpine ya lo trae como busybox applet, redundante pero explícito)
RUN apk add --no-cache wget

# Non-root user
RUN addgroup -S app && adduser -S app -G app

COPY --from=deps-full /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY mcp ./mcp

USER app

ENV MCP_PORT=3000
ENV NODE_ENV=production
EXPOSE 3000

# Healthcheck (también definido en compose; este es fallback)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --spider -q http://localhost:3000/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
