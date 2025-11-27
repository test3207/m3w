# All-in-One Docker Image (Frontend + Backend)
# Backend serves static frontend files
# Suitable for simple single-container deployment

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

# Copy frontend package
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci

# Build shared package
FROM base AS shared-builder
WORKDIR /app
COPY --from=deps /app/shared/node_modules ./shared/node_modules
COPY shared ./shared
RUN cd shared && npm run build

# Build frontend
FROM base AS frontend-builder
WORKDIR /app
COPY --from=shared-builder /app/shared ./shared
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules
COPY scripts ./scripts
COPY frontend ./frontend
RUN cd frontend && npm run build

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

# Install openssl for Prisma
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 honouser

# Copy shared package (needed as local dependency)
COPY --from=shared-builder --chown=honouser:nodejs /app/shared ./shared

# Copy backend package files and Prisma schema
COPY --from=builder --chown=honouser:nodejs /app/backend/package.json /app/backend/package-lock.json ./backend/
COPY --from=builder --chown=honouser:nodejs /app/backend/prisma ./backend/prisma

# Install production dependencies, generate Prisma client, then cleanup
# All in one layer to minimize image size
RUN cd backend && \
    npm ci --omit=dev && \
    npx prisma generate && \
    # Remove prisma CLI (~67MB), typescript (~23MB), and @types after generation
    rm -rf node_modules/prisma node_modules/typescript node_modules/@types && \
    # Remove effect package (~34MB) - only needed by prisma CLI
    rm -rf node_modules/effect node_modules/fast-check && \
    npm cache clean --force && \
    rm -rf /root/.npm /tmp/*

# Copy built backend
COPY --from=builder --chown=honouser:nodejs /app/backend/dist ./backend/dist

# Copy frontend dist (backend will serve it)
COPY --from=frontend-builder --chown=honouser:nodejs /app/frontend/dist ./backend/public

# Copy entrypoint script for runtime config injection
COPY --chown=honouser:nodejs docker/docker-entrypoint-allinone.sh ./backend/
RUN chmod +x ./backend/docker-entrypoint-allinone.sh

USER honouser

EXPOSE 4000

ENV PORT=4000
ENV HOST="0.0.0.0"
ENV SERVE_FRONTEND=true

# Health check - verify backend API is responding
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

WORKDIR /app/backend

ENTRYPOINT ["./docker-entrypoint-allinone.sh"]
CMD ["node", "dist/index.js"]
