#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$DIR"

echo "=== UpBeat macOS Self-Updater ==="
echo "Updating workspace at $DIR..."

# Fetch latest commits from GitHub
if [ -d ".git" ]; then
    echo "Pulling latest code from GitHub..."
    git pull origin main || echo "Git pull completed or already up-to-date"
fi

# Rebuild frontend
if [ -d "argon_music/frontend" ]; then
    echo "Building latest frontend assets..."
    cd argon_music/frontend
    npm run build
    cd "$DIR"
fi

# Recompile native macOS Swift binary
echo "Recompiling native macOS app..."
swiftc -O -target arm64-apple-macos12.0 "$DIR/macos/UpBeatApp.swift" -o "$DIR/UpBeat.app/Contents/MacOS/UpBeat"
cp "$DIR/macos/UpBeat.icns" "$DIR/UpBeat.app/Contents/Resources/AppIcon.icns" 2>/dev/null || true

# Copy to /Applications if installed there
if [ -d "/Applications/UpBeat.app" ]; then
    echo "Updating /Applications/UpBeat.app..."
    rsync -a --delete "$DIR/UpBeat.app/" "/Applications/UpBeat.app/"
fi

echo "=== Update Complete ==="
