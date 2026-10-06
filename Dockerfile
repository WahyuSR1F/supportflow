FROM node:22-alpine

WORKDIR /app
ENV COREPACK_HOME=/corepack
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/production.js"]
