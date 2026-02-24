FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist dist
COPY --from=builder /app/package.json .
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/drizzle drizzle
COPY --from=builder /app/drizzle.config.ts .
EXPOSE 3000
CMD ["node", "dist/server/server-entry.js"]
