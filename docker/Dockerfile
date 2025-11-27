# All-in-One Docker Image (Frontend + Backend)
# Backend serves static frontend files
# Suitable for simple single-container deployment
#
# IMPORTANT: This Dockerfile expects PRE-BUILT artifacts in build context
# Build context should be: docker-build-output/
#
# Prerequisites (built by scripts/build-docker.ps1 or build-docker.sh):
#   - shared/dist/           (compiled shared package)
#   - shared/package.json
#   - backend/dist/          (compiled backend)
#   - backend/node_modules/  (production dependencies with Prisma client)
#   - backend/prisma/        (schema for migrations)
#   - frontend/dist/         (compiled frontend)
#
# Usage:
#   # Windows (full pipeline)
#   .\scripts\build-docker.ps1 -Type prod
#
#   # Linux/CI (full pipeline)
#   ./scripts/build-docker.sh prod
#
#   # Manual (after artifacts built)
#   docker build -f docker/Dockerfile -t m3w:latest docker-build-output/

FROM node:25.2.1-alpine

WORKDIR /app

ENV NODE_ENV=production

# Install runtime dependencies and create non-root user
RUN apk add --no-cache openssl dumb-init && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 honouser

# Note: @m3w/shared is bundled into backend dist via tsup noExternal config

# Copy pre-built backend (includes node_modules with Prisma client)
COPY --chown=honouser:nodejs backend/dist ./backend/dist
COPY --chown=honouser:nodejs backend/node_modules ./backend/node_modules
COPY --chown=honouser:nodejs backend/prisma ./backend/prisma
COPY --chown=honouser:nodejs backend/package.json ./backend/

# Copy pre-built frontend (served by backend)
COPY --chown=honouser:nodejs frontend/dist ./backend/public

# Copy entrypoint script
COPY --chown=honouser:nodejs docker/docker-entrypoint-allinone.sh ./backend/docker-entrypoint.sh
RUN chmod +x ./backend/docker-entrypoint.sh

USER honouser

EXPOSE 4000

ENV PORT=4000
ENV HOST="0.0.0.0"
ENV SERVE_FRONTEND=true

# Health check should be configured by orchestrator (docker-compose, Kubernetes)
# Example: GET /api/health returns 200 when healthy

WORKDIR /app/backend

ENTRYPOINT ["dumb-init", "--", "./docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
