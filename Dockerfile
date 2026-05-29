FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm@10.32.1

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile

COPY src/ ./src/
COPY scripts/ ./scripts/

COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 5200

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
