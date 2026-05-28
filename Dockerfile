FROM node:24-alpine

WORKDIR /app

# Install pnpm matching the version specified in package.json
RUN npm install -g pnpm@10.32.1

# Copy dependency definitions
COPY package.json pnpm-lock.yaml ./

# Install dependencies (production only to keep size minimal)
RUN pnpm install --prod --frozen-lockfile

# Copy application files
COPY src/ ./src/
COPY scripts/ ./scripts/

# Copy entrypoint script to /usr/local/bin/
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Expose port (application default port is 5200)
EXPOSE 5200

# Set entrypoint
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
