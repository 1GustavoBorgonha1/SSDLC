# syntax=docker/dockerfile:1
# Imagem da aplicação SalaFácil — SPEC-006 §3, NFR-5 (imagem enxuta) e
# NFR-S12 (usuário não-root).

FROM node:22-alpine AS deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci

# Árvore de produção isolada: o estágio final só copia, nunca instala,
# o que mantém a imagem enxuta (NFR-5).
FROM node:22-alpine AS prod-deps
WORKDIR /app
COPY app/package.json app/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY app/package.json app/tsconfig.json ./
COPY app/src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# --chown no COPY evita duplicar node_modules numa camada extra (NFR-5).
COPY --chown=node:node app/package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node app/public ./public

# SEC-3 — remove o npm CLI global da imagem base: o runtime só executa
# `node dist/main.js`, nunca `npm`, e o npm embutido carrega dependências
# próprias (tar, brace-expansion, sigstore) que ficam desatualizadas na
# imagem base do Node e disparam CVEs no Trivy sem afetar a aplicação.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/lib/node_modules/corepack /usr/local/bin/corepack

# NFR-S12 — o processo roda como o usuário `node`, já presente na imagem base.
RUN install -d -o node -g node /data
USER node

ARG APP_VERSION=dev
ENV APP_VERSION=${APP_VERSION} \
    DATABASE_FILE=/data/salafacil.db \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

# FR-10 — o healthcheck do contêiner usa o mesmo endpoint do smoke test do deploy.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
