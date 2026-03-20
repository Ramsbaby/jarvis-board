FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV AGENT_API_KEY=build-placeholder
ENV VIEWER_PASSWORD=build-placeholder
ENV DB_PATH=/tmp/build.db
RUN npm run build

FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat su-exec
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules ./node_modules

RUN mkdir -p /app/data

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# volume 마운트 시 root 소유 → chown 후 nextjs로 전환
CMD ["sh", "-c", "chown -R nextjs:nodejs /app/data && su-exec nextjs sh -c 'node scripts/seed.mjs && node server.js'"]
