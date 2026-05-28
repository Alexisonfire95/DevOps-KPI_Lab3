#!/bin/sh
set -e

# Config file setup
CONFIG_PATH="${CONFIG_PATH:-/etc/mywebapp/config.yaml}"
CONFIG_DIR="$(dirname "$CONFIG_PATH")"

if [ ! -d "$CONFIG_DIR" ]; then
  mkdir -p "$CONFIG_DIR"
fi

if [ ! -f "$CONFIG_PATH" ]; then
  echo "Generating configuration file at $CONFIG_PATH..."
  cat <<EOF > "$CONFIG_PATH"
server:
  host: "${APP_HOST:-0.0.0.0}"
  port: ${APP_PORT:-5200}

database:
  host: "${DB_HOST:-db}"
  port: ${DB_PORT:-5432}
  user: "${DB_USER:-mywebapp}"
  password: "${DB_PASSWORD:-mywebapp_password}"
  name: "${DB_NAME:-mywebapp}"
EOF
fi

export CONFIG_PATH

# Wait for DB to become available
node scripts/wait-for-db.js

# Run migrations
echo "Running migrations..."
node src/migrate.js

# Start application
echo "Starting application..."
exec node src/index.js
