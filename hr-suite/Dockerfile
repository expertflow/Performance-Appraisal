# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build -- --configuration=production

# ── Stage 2: Run SSR Node server ──────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Copy only the server output and browser assets
COPY --from=builder /app/dist/hr-suite /app/dist/hr-suite
COPY --from=builder /app/node_modules /app/node_modules

EXPOSE 4000

ENV PORT=4000
ENV NODE_ENV=production

CMD ["node", "/app/dist/hr-suite/server/server.mjs"]
