# syntax=docker/dockerfile:1
# Debian slim, não Alpine: o onnxruntime-node (embeddings) não roda em musl.
FROM node:24-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
# NEXT_PUBLIC_* é gravada no bundle durante o build: mudou o domínio, reconstrua a imagem.
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Valores fictícios SÓ para este comando (não ficam na imagem): o `next build` importa os módulos
# do servidor e eles exigem as variáveis, mas nada se conecta ao banco no build.
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    BETTER_AUTH_SECRET="build-only-placeholder-not-used-at-runtime" \
    sh -c "npx prisma generate && npm run build"

# Serviço `migrate` do compose: o builder tem a CLI do Prisma, o prisma.config.ts, o seed (tsx) e as
# dependências de desenvolvimento. O openssl é para o motor de migrations do Prisma, que não o
# acha na imagem slim e avisa que "pode não funcionar" (aqui funcionou, mas em outra arquitetura
# ou versão pode não funcionar). Fica fora do `runner`, que não precisa dele.
FROM builder AS migrator
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
 && rm -rf /var/lib/apt/lists/*

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 HF_HOME=/app/.cache
RUN groupadd --system --gid 1001 nodejs \
 && useradd --system --uid 1001 --gid nodejs nextjs \
 && mkdir -p /app/.cache && chown nextjs:nodejs /app/.cache
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
