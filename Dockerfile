FROM node:20-alpine

RUN npm install -g pnpm

WORKDIR /app

# Copy manifests first for better layer caching.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY botBackEnd/package.json  ./botBackEnd/
COPY botWorker/package.json   ./botWorker/
COPY libs/database/package.json ./libs/database/
COPY libs/queue/package.json    ./libs/queue/
COPY libs/types/package.json    ./libs/types/
COPY libs/logger/package.json   ./libs/logger/

RUN pnpm install --frozen-lockfile

COPY botWorker/ ./botWorker/
COPY libs/      ./libs/

RUN pnpm --filter botWorker run build

# No EXPOSE — botWorker has no HTTP port
CMD ["node", "botWorker/dist/main.js"]
