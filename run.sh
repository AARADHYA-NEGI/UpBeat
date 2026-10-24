#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "🎵 Starting UpBeat Music Studio..."

# Build frontend if dist doesn't exist
if [ ! -d "frontend/dist" ]; then
    echo "📦 Building frontend assets..."
    (cd frontend && npm install && npm run build)
fi

# Activate Python environment if present
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "🚀 Launching UpBeat Server on http://localhost:8000"
exec python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
