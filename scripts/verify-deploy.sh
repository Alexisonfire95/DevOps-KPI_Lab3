#!/bin/bash
set -euo pipefail

TARGET_IP="${1:-192.168.56.10}"

echo "==> Starting post-deploy verification for target: ${TARGET_IP}"

echo "1. Checking /tasks endpoint accessibility via Nginx..."
TASKS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${TARGET_IP}/tasks")
if [ "$TASKS_STATUS" -eq 200 ]; then
  echo "   [OK] /tasks is accessible via Nginx (status 200)"
else
  echo "   [FAIL] /tasks returned status $TASKS_STATUS (expected 200)" >&2
  exit 1
fi

echo "2. Checking direct /health/alive on port 5200..."
ALIVE_BODY=$(curl -sf "http://${TARGET_IP}:5200/health/alive")
if [ "$ALIVE_BODY" = "OK" ]; then
  echo "   [OK] Direct /health/alive returned 'OK'"
else
  echo "   [FAIL] Direct /health/alive returned '$ALIVE_BODY' (expected 'OK')" >&2
  exit 1
fi

echo "3. Checking if Nginx blocks /health/alive..."
NGINX_HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${TARGET_IP}/health/alive")
if [ "$NGINX_HEALTH_STATUS" -eq 404 ]; then
  echo "   [OK] Nginx successfully blocked /health/alive (status 404)"
else
  echo "   [FAIL] Nginx did NOT block /health/alive, returned status $NGINX_HEALTH_STATUS (expected 404)" >&2
  exit 1
fi

echo "4. Testing Task Lifecycle (Create & Read task)..."
TASK_TITLE="verification-task-$(date +%s)"
echo "   Creating task: '${TASK_TITLE}'"

CREATE_RESPONSE=$(curl -sf -X POST \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "{\"title\":\"${TASK_TITLE}\"}" \
  "http://${TARGET_IP}/tasks")

TASK_ID=$(echo "$CREATE_RESPONSE" | jq -r '.id')

if [ -n "$TASK_ID" ] && [ "$TASK_ID" != "null" ]; then
  echo "   [OK] Task created successfully with ID: ${TASK_ID}"
else
  echo "   [FAIL] Failed to create task or parse ID. Response: $CREATE_RESPONSE" >&2
  exit 1
fi

echo "   Retrieving task list to verify task exists..."
LIST_RESPONSE=$(curl -sf -H "Accept: application/json" "http://${TARGET_IP}/tasks")

if echo "$LIST_RESPONSE" | jq -e ".[] | select(.title == \"${TASK_TITLE}\")" >/dev/null; then
  echo "   [OK] Task successfully found in the tasks list!"
else
  echo "   [FAIL] Task was not found in the tasks list. Response: $LIST_RESPONSE" >&2
  exit 1
fi

echo "==> All post-deploy verifications PASSED successfully!"
exit 0
