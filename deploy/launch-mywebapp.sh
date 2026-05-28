#!/bin/bash
set -euo pipefail

APP_DIR="${DEPLOY_APP_DIR:-/opt/mywebapp}"
CONFIG="${CONFIG_PATH:-${DEPLOY_APP_CONFIG_FILE:-/etc/mywebapp/config.yaml}}"
cd "$APP_DIR"
export NODE_ENV=production

case "${1:-}" in
	migrate) exec node src/migrate.js --config "$CONFIG" ;;
	serve | socket) export CONFIG_PATH="$CONFIG"; exec node src/index.js ;;
	*)
		echo "usage: $0 migrate|serve|socket" >&2
		exit 1
		;;
esac
