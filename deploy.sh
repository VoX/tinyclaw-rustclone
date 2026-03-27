#!/bin/bash
# Deploy script for rustclone
# ALWAYS runs pre-deploy checks before deploying
set -e

cd "$(dirname "$0")"

echo "=== PRE-DEPLOY CHECKS ==="

echo "--- 1. Building client bundle ---"
npx esbuild client/index.js --bundle --outfile=client/dist/bundle.js --format=esm --sourcemap

echo "--- 2. Verifying client bundle (scope/reference errors) ---"
node tests/verify-client.js
if [ $? -ne 0 ]; then
  echo "❌ DEPLOY BLOCKED: Client verification failed"
  exit 1
fi

echo "--- 3. Checking server syntax ---"
node --check server/index.js
if [ $? -ne 0 ]; then
  echo "❌ DEPLOY BLOCKED: Server syntax error"
  exit 1
fi

echo "--- 4. Quick server start test ---"
# Stop Docker container first so port 8780 is free
docker stop rustclone 2>/dev/null || true
docker rm rustclone 2>/dev/null || true
sleep 1
timeout 8 node server/index.js &
SERVER_PID=$!
sleep 4
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ DEPLOY BLOCKED: Server crashed on startup"
  wait $SERVER_PID 2>/dev/null
  exit 1
fi
# Connect a bot to test basic functionality
node -e "
import { Bot } from './tests/bot.js';
const bot = new Bot('ws://localhost:8780');
try {
  await bot.connect(3000);
  console.log('Bot connected, eid:', bot.eid, 'pos:', bot.position);
  if (!bot.eid) throw new Error('No entity assigned');
  bot.disconnect();
  console.log('--- Bot connection test PASSED ---');
} catch(e) {
  console.error('--- Bot connection test FAILED:', e.message, '---');
  process.exit(1);
}
" 2>&1
BOT_EXIT=$?
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null
if [ $BOT_EXIT -ne 0 ]; then
  echo "❌ DEPLOY BLOCKED: Bot connection test failed"
  exit 1
fi

echo ""
echo "=== ALL CHECKS PASSED — DEPLOYING ==="
echo ""

echo "--- Building Docker image ---"
docker build -t rustclone .

echo "--- Starting new container ---"
docker run -d --name rustclone -p 8780:8780 --restart unless-stopped \
  -v /home/ec2-user/projects/rustclone/data:/app/data rustclone

echo "--- Waiting for startup ---"
sleep 3
docker logs rustclone 2>&1 | tail -3

echo "--- Verifying public URL ---"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://claw.bitvox.me/rustclone/)
if [ "$HTTP_CODE" != "200" ]; then
  echo "⚠️  WARNING: Public URL returned HTTP $HTTP_CODE"
else
  echo "HTTP 200 OK"
fi

echo ""
echo "=== DEPLOY COMPLETE ==="
