#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR/.."

# Activate virtualenv if present
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

echo "================================================"
echo "⚡ Starting ArgonBeat (Flash + Argon Music App)"
echo "   Backend & Frontend on: http://localhost:8000"
echo "================================================"

python -m uvicorn argon_music.backend.main:app --host 0.0.0.0 --port 8000 --reload
