#!/bin/bash
set -e
echo "=== Installing dependencies ==="
npm install
echo "=== Installing webview-ui dependencies ==="
cd webview-ui && npm install && cd ..
echo "=== Building ==="
npm run build
echo "=== Done ==="
