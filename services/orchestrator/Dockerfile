# The worker image (Railway). Build from the repo root:
#   docker build -f services/orchestrator/Dockerfile .
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/
COPY packages/media/package.json packages/media/
COPY services/orchestrator/package.json services/orchestrator/
RUN npm ci --omit=dev --workspace @mmos/orchestrator --include-workspace-root=false
COPY packages/contracts packages/contracts
COPY packages/media packages/media
COPY services/orchestrator services/orchestrator
ENV NODE_ENV=production
WORKDIR /app/services/orchestrator
CMD ["npx", "tsx", "src/main.ts"]
