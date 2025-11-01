FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat git openssh && corepack enable
FROM base AS pruner
COPY . .
RUN mkdir -p /app/out/full \
  && sh -c "tar -cf - . --exclude='./out' | tar -C /app/out/full -xf -" \
  && cp pnpm-lock.yaml /app/out/pnpm-lock.yaml
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=pruner /app/out/full/ ./
RUN pnpm install --frozen-lockfile
RUN cd apps/backend && npx prisma generate
FROM installer AS builder
WORKDIR /app
RUN pnpm turbo build --filter=backend
WORKDIR /app
RUN pnpm prune --prod
WORKDIR /app/apps/backend
RUN test -f dist/main.js
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/node_modules ./apps/backend/node_modules
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/prisma ./apps/backend/prisma
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/services ./services
COPY --from=builder /app/apps/backend/package.json ./apps/backend/package.json
WORKDIR /app/apps/backend
EXPOSE 8080
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
FROM installer AS dev
ENV NODE_ENV=development
ENV CHOKIDAR_USEPOLLING=1
WORKDIR /app
CMD ["pnpm", "--filter", "backend", "start:dev"]
