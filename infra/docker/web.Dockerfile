# Contexto de build: raiz do monorepo. Só pra paridade local via docker-compose —
# o deploy de produção (C.5) não usa Docker, é upload direto pro Firebase Hosting.
FROM node:24-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
COPY . .
# Versão fixa e igual à do package.json da raiz: o node_modules fica fora do contexto
# (.dockerignore), e sem versão o npx baixaria o turbo mais recente.
RUN npx turbo@2.10.9 prune @hero/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
COPY tsconfig.base.json ./tsconfig.base.json
RUN pnpm turbo run build --filter=@hero/web

FROM nginx:alpine AS runner
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=installer /app/apps/web/dist/web/browser /usr/share/nginx/html
EXPOSE 8080
