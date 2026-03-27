#!/bin/bash
# Deploy script for rustclone
# Rebuilds client, Docker image, and redeploys the container
set -e

echo "=== Building client ==="
npx esbuild client/index.js --bundle --outfile=client/dist/bundle.js --format=esm --minify

echo "=== Stopping old container ==="
docker stop rustclone 2>/dev/null || true
docker rm rustclone 2>/dev/null || true

echo "=== Building Docker image ==="
docker build -t rustclone .

echo "=== Starting new container ==="
docker run -d --name rustclone -p 8780:8780 --restart unless-stopped \
  -v /home/ec2-user/projects/rustclone/data:/app/data rustclone

echo "=== Waiting for startup ==="
sleep 3
docker logs rustclone 2>&1 | tail -3

echo "=== Verifying ==="
curl -s -o /dev/null -w "HTTP %{http_code}" https://claw.bitvox.me/rustclone/
echo ""
echo "=== Deploy complete ==="
