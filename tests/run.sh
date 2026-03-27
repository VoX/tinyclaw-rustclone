#!/bin/bash
# E2E Test Runner - starts server, runs tests, reports results
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVER_PORT=8780
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "Stopping server (PID $SERVER_PID)..."
    kill "$SERVER_PID" 2>/dev/null
    wait "$SERVER_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT

echo "=== Starting game server ==="
cd "$PROJECT_DIR"

# Kill any existing server on port 8780
for pid in $(pgrep -f "node server/index.js" 2>/dev/null); do
  echo "Killing existing server process $pid"
  kill "$pid" 2>/dev/null || true
done

# Wait for port to actually be freed
PORT_WAIT=0
while [ $PORT_WAIT -lt 20 ] && ss -tlnp 2>/dev/null | grep -q ":${SERVER_PORT} "; do
  PORT_WAIT=$((PORT_WAIT + 1))
  sleep 0.5
done
sleep 1

node server/index.js &
SERVER_PID=$!

echo "Server PID: $SERVER_PID"
echo "Waiting for server to be ready..."

# Wait for server to accept WebSocket connections
MAX_RETRIES=30
RETRY=0
while [ $RETRY -lt $MAX_RETRIES ]; do
  # Try to connect via curl to HTTP endpoint
  if curl -s -o /dev/null -w "%{http_code}" "http://localhost:$SERVER_PORT/" 2>/dev/null | grep -q "200\|404"; then
    echo "Server is ready!"
    break
  fi
  RETRY=$((RETRY + 1))
  sleep 0.5
done

if [ $RETRY -ge $MAX_RETRIES ]; then
  echo "ERROR: Server failed to start within timeout"
  exit 1
fi

# Give server a moment to finish world generation
sleep 2

echo ""
echo "=== Running E2E Tests ==="
echo ""

# Run tests with node's built-in test runner (|| true to prevent set -e from killing the script)
node --test --test-timeout=300000 "$SCRIPT_DIR/e2e.test.js" 2>&1 || TEST_EXIT=$?
TEST_EXIT=${TEST_EXIT:-0}

echo ""
echo "=== Test run complete ==="

if [ $TEST_EXIT -eq 0 ]; then
  echo "RESULT: ALL TESTS PASSED"
else
  echo "RESULT: SOME TESTS FAILED (exit code: $TEST_EXIT)"
fi

exit $TEST_EXIT
