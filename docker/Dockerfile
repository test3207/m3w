# Backend Production Dockerfile (Hono API)
FROM node:25.2.1-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy shared package first
COPY shared/package.json shared/package-lock.json ./shared/
RUN cd shared && npm ci

# Copy backend package
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Build shared package
FROM base AS shared-builder
WORKDIR /app
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY shared ./shared
RUN cd shared && npm run build

# Build backend
FROM base AS builder
WORKDIR /app

# Build target argument (rc or prod)
ARG BUILD_TARGET=prod
ENV BUILD_TARGET=${BUILD_TARGET}

COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=shared-builder /app/shared ./shared
COPY backend ./backend

# Generate Prisma Client
RUN cd backend && npx prisma generate

# Build backend with specified target
RUN cd backend && npm run build:${BUILD_TARGET}

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 honouser

# Copy shared package
COPY --from=shared-builder --chown=honouser:nodejs /app/shared ./shared

# Copy backend
COPY --from=builder --chown=honouser:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=honouser:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=honouser:nodejs /app/backend/prisma ./backend/prisma
COPY --from=builder --chown=honouser:nodejs /app/backend/package.json ./backend/

USER honouser

EXPOSE 4000

ENV PORT=4000
ENV HOST="0.0.0.0"

WORKDIR /app/backend

CMD ["node", "dist/index.js"]
