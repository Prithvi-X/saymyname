# SayMyName.in — API Service Production Container Image
# Ensures system FFmpeg (with HEVC/HEIC decode support) and native runtime libs are present
# so server-side image sanitization and HEIC -> JPEG conversion operate fail-safe in production.

FROM node:22-trixie-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY services/api ./services/api

RUN npm ci \
  --workspace=@saymyname/contracts \
  --workspace=@saymyname/database \
  --workspace=@saymyname/design-tokens \
  --workspace=@saymyname/validation \
  --workspace=@saymyname/api \
  --include-workspace-root=true

RUN npm run --workspace=@saymyname/api build

FROM node:22-trixie-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Required runtime dependency: FFmpeg for server-side HEIC -> JPEG still decode + OpenSSL for Prisma
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && ffmpeg -hide_banner -decoders | grep -qi hevc

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/packages/contracts ./packages/contracts
COPY --from=builder /app/packages/database ./packages/database
COPY --from=builder /app/packages/design-tokens ./packages/design-tokens
COPY --from=builder /app/packages/validation ./packages/validation
COPY --from=builder /app/services/api ./services/api

USER node
WORKDIR /app/services/api
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
