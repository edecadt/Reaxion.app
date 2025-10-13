FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat git openssh && corepack enable
ENV NEXT_TELEMETRY_DISABLED=1
FROM base AS pruner
COPY . .
RUN mkdir -p /app/out \
  && (npx turbo prune --scope=web --docker --out-dir=/app/out || \
     (echo "turbo prune failed; falling back to full workspace" && \
      mkdir -p /app/out/full && \
      sh -c "tar -cf - . --exclude='./out' | tar -C /app/out/full -xf -" && \
      cp pnpm-lock.yaml /app/out/pnpm-lock.yaml))
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/full/ ./
RUN pnpm install --frozen-lockfile
FROM installer AS builder
WORKDIR /app
RUN pnpm turbo build --filter=web
RUN test -f apps/web/.next/BUILD_ID || test -d apps/web/.next
FROM node:20-alpine AS runner
ENV NODE_ENV=production
ENV PORT=8081
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages ./packages
WORKDIR /app/apps/web
EXPOSE 8081
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "8081", "-H", "0.0.0.0"]
FROM installer AS dev
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=1
WORKDIR /app
CMD ["pnpm", "--filter", "web", "dev", "--", "-p", "8081", "-H", "0.0.0.0"]
