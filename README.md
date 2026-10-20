# UpBeat — AI Music Curator (macOS + Android + Web)

Minimalist AI-curated music studio powered by Google Gemini 3.x / 4 models and YouTube Music (`WEB_REMIX`), featuring live Safari YouTube tab sync, persistent Favorites taste memory, semantic match-tiering (`Direct Match`, `Close Fit`, `Exploratory`), and transparent model fallback telemetry.

---

## Features

- **Multi-Model Gemini Curation**: Supports `gemini-3.8-flash`, `gemini-4-argon` (ER-2 fast mode), `gemini-3.1-flash-lite`, `gemini-3.5-flash-lite`, `gemini-3-flash-preview`, `gemini-2.5-flash`, `gemma-4-26b-a4b-it`, and OpenAI/Groq/OpenRouter endpoints.
- **Live YouTube Music Catalog Grounding**: Grounds specific franchise, anime, soundtrack, and artist searches directly in verified YouTube Music tracks with zero cross-history pollution.
- **Persistent Favorites Memory**: Heart any track in the Curator, Safari Library, or bottom Player Bar to store it in your persistent Favorites memory and guide future curations.
- **Native Standalone macOS App (`UpBeat.app`)**: Compiled native Swift + `WKWebView` macOS app that manages the local backend automatically.
- **Android Mobile App (Capacitor APK + PWA)**:
  - **GitHub Actions APK Build**: Automatically compiles `UpBeat-Android-APK` (`app-debug.apk`) on every push to `main`.
  - **Standalone Mobile Engine**: Works anywhere on Android (mobile data or Wi-Fi) by calling Gemini directly or syncing with your Mac server over LAN.

---

## Quick Start

### 1. macOS Native App (`UpBeat.app`)
Launch **UpBeat** directly from `/Applications/UpBeat.app` (or `./UpBeat.app` in the repository root), or rebuild it anytime:
```bash
swiftc macos/UpBeatApp.swift -o UpBeat.app/Contents/MacOS/UpBeat -framework Cocoa -framework WebKit -O
open UpBeat.app
```

### 2. Local Backend & Web / LAN Server
```bash
source .venv/bin/activate
python -m uvicorn argon_music.backend.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Android Phone Setup
- **Option A — Download Built APK from GitHub Actions**:
  1. Go to the **Actions** tab of this repository on GitHub -> **Build UpBeat Android APK**.
  2. Download the **`UpBeat-Android-APK`** artifact (`app-debug.apk`) and install it on your Android phone.
  3. Tap the **Key** icon in the top-right bar of UpBeat on Android and paste your `GEMINI_API_KEY` (for standalone use anywhere on mobile data) or your Mac's LAN URL (`http://<mac-ip>:8000`).
- **Option B — Instant Installable PWA over Wi-Fi**:
  1. Open Chrome on Android and visit `http://<your-mac-lan-ip>:8000`.
  2. Tap **Add to Home Screen / Install App** to install **UpBeat** with its standalone dark interface.
