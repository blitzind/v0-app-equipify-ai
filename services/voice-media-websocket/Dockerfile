# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim

WORKDIR /app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY package.json pnpm-lock.yaml ./
# Install devDependencies too — runtime needs `tsx` to execute TypeScript entrypoints.
RUN pnpm install --frozen-lockfile --prod=false

COPY . .

ENV NODE_ENV=production

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 8080) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "-r", "./scripts/server-only-shim.cjs", "--import", "tsx", "services/voice-media-websocket/server.ts"]
