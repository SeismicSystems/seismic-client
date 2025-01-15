FROM oven/bun:latest
WORKDIR /app

COPY . .

ENTRYPOINT ["bun", "packages/seismic-spammer/src/index.ts"]