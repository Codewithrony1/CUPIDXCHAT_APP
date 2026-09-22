# ── CupidX Socket Server — Dockerfile ─────────────────────────────────────────
# Multi-stage build: keeps the final image lean by only copying runtime files.
# Designed for deployment on Render (Web Service) or Fly.io.
#
# Build context must be the REPOSITORY ROOT (not the socket/ subdirectory) so
# that the Prisma schema (prisma/schema.prisma) is accessible for `prisma generate`.
#
# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root package files for Prisma schema access
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations
COPY prisma.config.ts ./

# Copy socket-specific package manifest
COPY socket/package.json ./socket/package.json

# Install ONLY socket server dependencies (not the full Next.js tree)
WORKDIR /app/socket
RUN npm install --omit=dev

# Generate the Prisma client targeting the socket directory
WORKDIR /app
RUN npx prisma generate

# ── Stage 2: Runner ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy generated Prisma client
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy socket node_modules
COPY --from=builder /app/socket/node_modules ./socket/node_modules

# Copy application source
COPY socket/ ./socket/
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations

WORKDIR /app/socket

# Render and Fly.io inject PORT via environment variable
EXPOSE 3001

# Health check — Render uses this to determine readiness
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3001}/health || exit 1

CMD ["node", "server.js"]
