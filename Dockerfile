# Сборка: проверка типов, клиент (Vite) и сервер (esbuild), затем прод-зависимости сервера отдельно.
FROM node:24-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/data/package.json packages/data/
COPY packages/messages/package.json packages/messages/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN pnpm install --frozen-lockfile

COPY packages packages
RUN pnpm build
RUN pnpm --filter @gene/server deploy --prod --legacy /prod/server \
    && cp -r packages/server/dist /prod/server/dist \
    && cp -r packages/client/dist /prod/client

# Рантайм: только собранный сервер, клиент и нативные зависимости.
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    GENE_PORT=3000 \
    GENE_DB=/data/gene.db \
    GENE_CLIENT_DIR=/app/client
WORKDIR /app
COPY --from=build /prod/server /app/server
COPY --from=build /prod/client /app/client
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "server/dist/main.js"]
