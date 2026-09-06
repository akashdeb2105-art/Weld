# ── Build stage ─────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /repo

# Copy workspace manifests first for layer caching.
COPY package.json package-lock.json* tsconfig.base.json ./
COPY packages/gamebible/package.json packages/gamebible/package.json
COPY packages/sample-game/package.json packages/sample-game/package.json
COPY frontend/package.json frontend/package.json

RUN npm install --no-audit --no-fund

# Source.
COPY tsconfig.base.json ./
COPY packages/gamebible packages/gamebible
COPY packages/sample-game packages/sample-game
COPY frontend frontend

ARG WELD_API_URL=http://api:8000
ENV WELD_API_URL=$WELD_API_URL

# Build sample game, then the web app (prebuild copies the game into public/).
RUN npm run build -w @weld/sample-game && npm run build -w @weld/web

# ── Runtime stage ───────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Next standalone output.
COPY --from=builder /repo/frontend/.next/standalone ./
COPY --from=builder /repo/frontend/.next/static ./frontend/.next/static
COPY --from=builder /repo/frontend/public ./frontend/public

EXPOSE 3000
CMD ["node", "frontend/server.js"]
