#!/bin/bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: $0 <image-tag>" >&2
  exit 1
fi

IMAGE_TAG="$1"
IMAGE_NAME="ghcr.io/alexisonfire95/devops-kpi_lab3:${IMAGE_TAG}"

echo "==> Pulling Docker image: ${IMAGE_NAME}"
docker pull "${IMAGE_NAME}"

echo "==> Running database migrations inside temporary container"
docker run --rm \
  --entrypoint "" \
  --network host \
  -v /etc/mywebapp:/etc/mywebapp:ro \
  -e CONFIG_PATH=/etc/mywebapp/config.yaml \
  -e NODE_ENV=production \
  "${IMAGE_NAME}" node src/migrate.js

echo "==> Restarting mywebapp-container service"
sudo systemctl restart mywebapp-container

echo "==> Waiting 5 seconds for service to initialize"
sleep 5

echo "==> Verifying service status"
if sudo systemctl is-active mywebapp-container >/dev/null; then
  echo "Service mywebapp-container is active and running!"
else
  echo "Error: mywebapp-container is NOT active!" >&2
  sudo systemctl status mywebapp-container || true
  exit 1
fi
