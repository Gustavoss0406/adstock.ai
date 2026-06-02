#!/bin/bash
set -e
echo "=== Installing dependencies ==="
npm install
echo "=== Installing webview-ui dependencies ==="
cd webview-ui && npm install && cd ..
echo "=== Building (skip lint + typecheck for production) ==="
npm run asyncapi:generate
node esbuild.js
npm run build:webview
echo "=== Done ==="
