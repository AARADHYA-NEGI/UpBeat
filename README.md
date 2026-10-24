# 🎵 UpBeat

A minimalist, high-fidelity AI music studio that understands what you actually like.

UpBeat pairs Google Gemini with YouTube Music to sequence harmonic DJ sets, decode your personal musical taste into a **Sonic DNA profile**, and stream music with zero ads, zero trackers, and zero subscription paywalls.

Built as a clean cross-platform project for **Android**, **macOS**, and the **Web**.

---

## ✨ Highlights

- **Dynamic Day / Night Atmosphere**: The app shifts ambient gradient lighting and cyber grid reflections automatically based on your local time:
  - 🌅 **Sunrise Crimson** (4:00 AM – 11:59 AM)
  - ☀️ **Radiant Azure & Gold** (12:00 PM – 7:59 PM)
  - 🌌 **Cosmic Midnight Violet** (8:00 PM – 3:59 AM)
- **Personalized Sonic Taste DNA**: Real-time profiling of your listener archetype, acoustic vs. electronic balance, subgenres, and tempo (BPM) based strictly on your own listening habits.
- **Android Native App & Android Auto**:
  - Full foreground media playback with responsive notification controls.
  - Native in-car dashboard support via Android Auto (`AutomotiveApp`).
  - Seamless background playback throttled to conserve battery and CPU.
  - **Live Over-The-Air (OTA) Updates**: Pull and apply UI updates and fixes directly inside the app without reinstalling the APK.
- **macOS Native Companion**:
  - Native Swift + Cocoa + WebKit app (`UpBeat.app`).
  - One-click discovery of active Safari YouTube & YouTube Music tabs via AppleScript.
- **Offline Storage**: Save any song to client-side IndexedDB for instant offline listening anytime, even in airplane mode.
- **Zero-Token Direct Search**: Instantly find any song, artist, album, or YouTube playlist without burning Gemini API tokens.

---

## 🏛️ Architecture

```
UpBeat/
├── android/          # Native Android App (Capacitor shell, MediaNotification Service, Android Auto)
├── macos/            # Native macOS App (Swift, Cocoa, WebKit wrapper, menu bar launcher)
├── backend/          # Python FastAPI Server (Safari AppleScript bridge, streaming, curator)
├── frontend/         # React 19 + Vite Client (Atmosphere theme, IndexedDB offline, OTA engine)
├── .github/          # GitHub Actions CI/CD (automatic APK compilation & OTA bundle releases)
└── run.sh            # One-click startup script for local development
```

---

## 🚀 Quick Start

### 1. Android Phone
- **Download the APK**: Grab the latest `UpBeat.apk` from [GitHub Releases](https://github.com/AaradhyaNegi009/UpBeat/releases).
- **Over-The-Air (OTA)**: Once installed, UpBeat updates itself automatically in the background. You can also tap **Settings (⚙️)** -> **"Check for Live Update"** to pull instant updates.

### 2. macOS Native App
Launch the precompiled native app or build it with Swift:
```bash
# Compile and open UpBeat on macOS
swiftc -O -target arm64-apple-macos12.0 macos/UpBeatApp.swift -o UpBeat.app/Contents/MacOS/UpBeat -framework Cocoa -framework WebKit
open UpBeat.app
```

### 3. Web & Local Development
Start the local server with one command:
```bash
./run.sh
```
Or manually:
```bash
# 1. Build frontend
cd frontend && npm install && npm run build && cd ..

# 2. Start Python API server
source .venv/bin/activate
pip install -r backend/requirements.txt
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Open **[http://localhost:8000](http://localhost:8000)** in any browser.

---

## 🔑 Configuration (Optional)

UpBeat works out of the box with **Direct Search (0 tokens)**. To unlock custom Gemini AI curation:
1. Tap the **Settings (⚙️)** icon in the top navigation bar.
2. Enter your free **Gemini API Key** from [Google AI Studio](https://aistudio.google.com).
3. If using an Android device on the same local Wi-Fi as your Mac, enter your Mac's LAN address (`http://192.168.x.x:8000`) to sync live Safari tabs.

---

## 📄 License
MIT License. Created by [Aaradhya Negi](https://github.com/AaradhyaNegi009).
