FROM oven/bun:latest
WORKDIR /app

COPY . .
ENTRYPOINT ["bun", "packages/spammer/src/index.ts"]