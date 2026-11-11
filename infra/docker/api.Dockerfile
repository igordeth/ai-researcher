# Contexto de build: raiz do monorepo (docker-compose.yml usa `context: .`)
FROM node:24-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
COPY . .
# Versão fixa e igual à do package.json da raiz: o node_modules fica fora do contexto
# (.dockerignore), e sem versão o npx baixaria o turbo mais recente.
RUN npx turbo@2.10.9 prune @hero/api --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=@hero/api

FROM base AS runner
WORKDIR /app
RUN addgroup --system --gid 1001 fastify && adduser --system --uid 1001 fastify
COPY --from=installer /app .
USER fastify
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]
