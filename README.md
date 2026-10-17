# Meet // Console

A multi-person video meeting app (React + Vite + WebRTC) with a live AI
dashboard beside the call. While people talk, the app transcribes each
speaker, condenses what they said into short points, keeps a rolling
meeting summary, and flags harmful language in speech and chat.

AI runs on **Google Gemini via LangChain** (speech-to-text, condensation,
and summary). Video never goes through the server.

```
┌─────────────────────────────┬──────────────────────────┐
│                              │  AI Dashboard — Live      │
│   Video grid (WebRTC)        │  ─────────────────────    │
│                              │  Speaker points (grouped) │
│   [ Mute ][ Video ][ Listen ]│  Rolling summary          │
│                              │  Moderation alerts        │
│                              │  Chat                     │
└─────────────────────────────┴──────────────────────────┘
```

## How it works

1. Each participant’s mic is analyzed in the browser with the Web Audio
   API (RMS energy + a silence hangover). That is Voice Activity
   Detection (VAD). Audio is only sent to the server while someone is
   speaking.
2. When speech ends (or an utterance hits the max length), the buffered
   segment (`webm/opus` via `MediaRecorder`) is sent to the backend over
   Socket.io as `audio:chunk`.
3. The backend converts the blob to WAV with **ffmpeg**, then transcribes
   it with **Gemini** (`GEMINI_API_KEY_VOICE`). Nearby fragments from the
   same speaker are merged before condensation.
4. **Gemini + LangChain** condenses the line into a short dashboard
   point, classifies intent, and streams tokens so the UI can type them
   out. Per-speaker history is kept in memory and trimmed.
5. After `SUMMARY_EVERY_N_LINES` new transcript lines (default **1**), a
   rolling whole-meeting summary is regenerated (Gemini, or optionally
   Hugging Face).
6. Chat is filtered with a local keyword list **before** broadcast.
   Speech intent (aggressive, harassment, profanity, threat) can raise
   a dashboard alert.
7. WebRTC video/audio is a mesh: Socket.io is only **signaling** (SDP
   and ICE). Camera frames never hit the server. Separate VAD-gated
   clips are the only audio the AI pipeline sees.

## Features

- Multi-person video (WebRTC mesh) with mute, camera, and AI-listen
  controls
- Live speaker notes with streaming typewriter text
- Rolling meeting summary
- In-meeting chat with bad-word blocking
- Firebase auth: email, Google, GitHub, Microsoft, phone OTP, or guest
- Invite link / room code, calendar helper, email summary (Resend or SMTP)
- Dark / light theme
- Optional MediaPipe hand gestures (client-side), including cutting the
  camera on a restricted gesture
- Optional TURN for guests on other networks

## Project layout

```
meet-app/
  backend/            Express + Socket.io signaling & AI pipeline
    server.js
    roomStore.js              in-memory rooms (lost on restart)
    badWordFilter.js          chat lexicon
    services/
      transcriptionService.js Gemini multimodal STT (+ ffmpeg)
      condensationService.js  short points + intent (LangChain)
      summaryService.js       rolling summary (Gemini / Hugging Face)
      emailService.js         Resend or SMTP
    python/                   leftover local Whisper server (unused)
  frontend/           React (Vite) client
    src/
      App.jsx                 auth, join, meeting shell
      hooks/                  Socket.io, WebRTC, VAD, audio pipeline
      components/             video, dashboard, chat, modals
      gestures/               MediaPipe hand landmarker
      lib/                    Firebase, theme, ICE/TURN
  start.sh            start backend + frontend together
```

## Requirements

- **Node.js 18+**
- **ffmpeg** on the backend host (required for STT)
- **Gemini API keys** (voice for STT, text for condensation/summary;
  they can be the same key)
- **Firebase** project if you want OAuth / phone auth (guest still works
  without it)
- Camera/mic need **HTTPS or localhost**

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# set GEMINI_API_KEY_VOICE and GEMINI_API_KEY_TEXT
npm run dev                # http://localhost:4000
```

Confirm ffmpeg is on your PATH (`ffmpeg -version`). On macOS:
`brew install ffmpeg`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # add VITE_FIREBASE_* for social/phone login
npm run dev                # http://localhost:5173
```

In local `npm run dev`, Vite proxies `/api` and `/socket.io` to the
backend, so you can leave `VITE_BACKEND_URL` unset.

### 3. One-command local start

From the repo root (after installing deps and filling `.env` files):

```bash
./start.sh
```

## How to use

Open **http://localhost:5173** after the backend and frontend are
running. A standalone copy of these steps is in `description.md`.

### Sign in

1. Open the app. Optional: sun / moon (top right) for light or dark
   theme.
2. Choose a method:

| Tab | What to do |
|---|---|
| **Email** | Sign in, or switch to **Create account** (display name, email, password). |
| **Social** | Google, GitHub, or Microsoft (Firebase providers must be enabled). |
| **Phone** | Number with country code, send OTP, enter the SMS code. |
| **Guest** | Type a display name. No Firebase account is created. |

If Firebase is not configured, only guest sign-in is available.

### Start or join a room

**Host:** click **Generate** (or type a code), confirm **Your name in
the call**, click **Enter the room**, allow camera and microphone.
Share the **exact same room code**.

**Join with a code:** type the code, enter your name, enter the room,
allow camera and mic.

**Join from an invite:** if the URL has `?room=...`, the room field is
filled. Enter your name and enter the room.

To test two people on one machine, open a second tab and join the same
room. Wait until the header says **Live** before relying on chat or AI
notes.

### Call controls (bottom bar)

| Control | What it does |
|---|---|
| **Microphone** | Mute / unmute. |
| **Play / pause (center)** | Start or pause **AI listening**. The video call continues either way. When listening is on, speech becomes dashboard notes. |
| **Camera** | Turn your video on or off. |
| **Leave** | Return to the join screen. |

Header: **grid** vs **spotlight** layout, **link** to copy invite URL
or room code. Sidebar brand or header **back** also leaves the call.
**Sign out** is on the join screen.

### Live AI dashboard

Open **AI Summary** (right panel or sidebar). Keep AI listening **on**
and speak. After you pause:

- **Speaker points** — short notes per person (text can type out live)
- **Rolling summary** — whole-meeting takeaways
- **Moderation** — speech that looks aggressive, harassing, profane, or
  threatening can raise an alert

Allow a few seconds after you stop talking. A pipeline error in the
header usually means missing Gemini keys or ffmpeg. Room notes are
in memory; a backend restart clears them.

### Chat

Open **Chat**. Send text or emoji. Blocked words are filtered before
broadcast; others never see those messages. Unread count appears if
you are on the AI tab.

### Email recap

Mail icon in the sidebar. Enter a recipient and send. Needs
`RESEND_API_KEY` or SMTP on the backend.

### Calendar and gestures

- **Calendar** is a sample “Today” timeline, not a live room calendar.
- **Gestures** (on the video area): client-side MediaPipe. **Safety
  Detection** can cut your camera on a restricted gesture; you can
  turn the camera back on from the notice.

### Typical full flow

1. Start backend + frontend (`./start.sh` or both `npm run dev`).
2. Sign in (or continue as guest).
3. Generate or enter a room code, set your name, enter the room.
4. Allow camera and mic; wait for **Live**.
5. Invite others with the same code or invite link.
6. Keep AI listening on and talk; watch speaker points and the summary.
7. Use chat as needed; optionally email the recap.
8. Leave with the back button; sign out from the join screen if done.

Use Chrome (or another Chromium browser) for the most reliable camera,
mic, and WebRTC.

## Environment

Names only — never commit real keys.

### Backend (`backend/.env`)

| Variable | Purpose |
|---|---|
| `PORT` | Default `4000` |
| `CORS_ORIGIN` | Frontend origin (`http://localhost:5173`) |
| `GEMINI_API_KEY_VOICE` | Speech-to-text |
| `GEMINI_API_KEY_TEXT` | Condensation + summary |
| `GEMINI_VOICE_MODEL` / `GEMINI_TEXT_MODEL` | Default `gemini-3.1-flash-lite` |
| `SUMMARY_EVERY_N_LINES` | Refresh summary after N new lines |
| `SUMMARY_BACKEND` | `gemini` (default) or `huggingface` |
| `HF_TOKEN` | Only if summary uses Hugging Face |
| `RESEND_API_KEY` / `SMTP_*` | Email summary |
| `TURN_*` | Optional TURN for WebRTC across NATs |

### Frontend (`frontend/.env`)

| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | Production backend origin (unset locally) |
| `VITE_FIREBASE_*` | Auth app config |
| `VITE_TURN_*` | Optional TURN (overrides the public relay) |

## Deploy

- **Frontend:** Vercel (`frontend/`). Set `VITE_BACKEND_URL` to the
  backend origin.
- **Backend:** Railway (or similar). Nixpacks installs **ffmpeg**. Set
  Gemini keys, CORS, and email vars. Health check: `GET /api/health`.

## REST

| Method | Path | Use |
|---|---|---|
| `GET` | `/api/health` | Liveness |
| `GET` | `/api/rooms/:roomId` | Room snapshot |
| `GET` | `/api/rooms/:roomId/dashboard` | Dashboard snapshot |
| `POST` | `/api/rooms/:roomId/reset` | Clear room + LangChain history |
| `GET` | `/api/email/status` | Whether email is configured |
| `POST` | `/api/rooms/:roomId/email-summary` | Send summary mail |

## Notes

- Room state lives in memory. A backend restart empties meetings.
- Mesh WebRTC is fine for small rooms. Larger meetings need an SFU
  (mediasoup, LiveKit, and similar).
- `backend/python/faster_whisper_server.py` is leftover from an older
  local Whisper + Ollama design. The Node pipeline does **not** call it.
- Chat filtering is a keyword list, not a full safety system. Socket.io
  rooms are joinable by anyone with the room code.
- For a deeper architecture / viva walkthrough, see `PROJECT_VIVA.md`.
