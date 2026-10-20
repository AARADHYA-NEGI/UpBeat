# ⚡ ArgonBeat (powered by Gemini Flash & Argon)

An autonomous AI music curation app connected to your logged-in **Safari YouTube / YouTube Music** sessions, powered by **Gemini 3 Flash** and **Gemini 4 Argon**.

---

## 🌟 Key Features

1. **Autonomous Safari YouTube Bridge**
   - Seamlessly discovers and connects to your active **YouTube** and **YouTube Music** tabs in Safari via AppleScript.
   - Extracts your real liked songs (`/playlist?list=LM` or `/playlist?list=LL`), watch history (`/feed/history`), and currently playing audio without requiring complex API credentials or logging in again.
   - Live bidirectional remote control: play, pause, skip, and push tracks from the app directly to Safari!

2. **Sonic DNA Profile & Taste Archetype**
   - Decodes your listening history into a structured musical identity.
   - Identifies your acoustic vs. synthesized balance, preferred tempo brackets (BPM), primary subgenres, and dominant emotional moods.

3. **Hyper-Curated Playlist Generation**
   - Driven by **Gemini 3 Flash** (or **Gemini 4 Argon**).
   - Sequences tracklists like a DJ set with harmonic flow, tension, and release.
   - Generates a **personalized reasoning breakdown ("Why this track?")** for every song, explaining why it fits your current vibe and past taste.

4. **Dual Playback Engine**
   - **🎧 In-App Player**: High-fidelity playback with embedded YouTube streaming, volume control, animated frequency visualizer, and collapsible video popout.
   - **🧭 Safari Remote**: Control playback directly in your existing Safari window.

---

## 🚀 Quick Start

### 1. Requirements
- macOS with Safari installed
- Python 3.10+
- Node.js 18+
- Gemini API Key in `.env` (`GEMINI_API_KEY=...`)

### 2. Enable Safari Apple Events (One-time macOS setup)
In Safari:
- Go to `Settings` -> `Advanced` -> Check `Show features for web developers` (or `Develop menu`).
- In Safari menu bar, click `Develop` -> Check `Allow JavaScript from Apple Events`.

### 3. Run the App
```bash
./argon_music/run.sh
```
Or manually:
```bash
source .venv/bin/activate
python -m uvicorn argon_music.backend.main:app --host 0.0.0.0 --port 8000 --reload
```
Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## 🏗️ Architecture

```
argon_music/
├── backend/
│   ├── main.py             # FastAPI REST endpoints
│   ├── safari_bridge.py    # AppleScript & DOM inspection for Safari
│   ├── curator.py          # Gemini Flash & Argon prompt engineering
│   └── youtube_search.py   # Multi-threaded YouTube video/thumbnail resolution
├── frontend/
│   ├── src/
│   │   ├── components/     # Navbar, Sidebar, PlaylistView, PlayerBar, SonicDnaView, Visualizer
│   │   ├── App.jsx         # State orchestrator & playback manager
│   │   └── index.css       # Glassmorphism & neon dark theme
│   └── dist/               # Pre-built production bundle served by FastAPI
└── run.sh                  # One-click startup script
```
