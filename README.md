# Meet // Console

A multi-person video meeting app (React + Vite + WebRTC) with a live AI
dashboard beside the call that transcribes every speaker, condenses what
they said into short points, keeps a rolling meeting summary, and flags
harmful language — all backed by **free, local, no-API-key** models by
default.

```
┌─────────────────────────────┬──────────────────────────┐
│                              │  AI Dashboard — Live      │
│   Video grid (WebRTC)        │  ─────────────────────    │
│   65% width                  │  Speaker points (grouped) │
│                               │  Rolling summary          │
│   [ Mute ][ Video ][ Listen ]│  Moderation alerts        │
│                               │  35% width                │
└─────────────────────────────┴──────────────────────────┘
```

## How it works

1. Each participant's mic is analyzed client-side with the Web Audio API
   (RMS energy + a silence hangover) — this is Voice Activity Detection
   (VAD). Audio is only sent to the server while someone is actually
   speaking.
2. When speech ends, the buffered segment (webm/opus, via
   `MediaRecorder`) is sent to the backend over Socket.io.
3. The backend transcribes it with **faster-whisper** (local, free), then
   condenses the raw sentence into a ~12-word dashboard point with
   **Ollama (llama3.2)** — passing in the speaker's last 3 points so it
   understands continuity.
4. Every 2 new transcript lines, a rolling whole-meeting summary is
   regenerated (also via Ollama).
5. A rule-based moderation pass flags harmful language with a severity
   level, no external service required.
6. Everything streams back over Socket.io and renders in the dashboard,
   grouped by speaker, newest point first.

WebRTC video/audio itself is a standard mesh: Socket.io is only used for
*signaling* (exchanging SDP offers/answers and ICE candidates) — actual
video/audio never touches the server.

## Project layout

```
meet-app/
  backend/            Express + Socket.io signaling & AI pipeline server
    server.js
    roomStore.js       in-memory room state (empty until real events)
    services/
      whisperService.js       transcription (local faster-whisper / OpenAI)
      condensationService.js  raw text -> short point (Ollama / OpenAI)
      summaryService.js       rolling meeting summary (Ollama / OpenAI)
      moderationService.js    rule-based flagging (local / OpenAI)
    python/
      faster_whisper_server.py  local transcription server (Flask)
  frontend/           React (Vite) client
    src/
      hooks/
        useSocket.js        Socket.io connection
        useWebRTC.js         peer connections, remote streams
        useVAD.js             voice activity detection + waveform level
        useAudioPipeline.js   VAD-gated MediaRecorder -> backend
      components/
        VideoGrid.jsx, VideoTile.jsx, Waveform.jsx, MicControls.jsx
        SpeakerDashboard.jsx, SpeakerCard.jsx, SummaryPanel.jsx,
        ModerationDashboard.jsx
      App.jsx           join screen + meeting room shell
```

## Setup

You'll need **Node.js 18+**, **Python 3.9+**, and **Ollama**.

### 1. Local AI backends (free, no API keys)

**Ollama** (condensation + rolling summary):

```bash
# install from https://ollama.com, then:
ollama pull llama3.2
ollama serve          # listens on http://localhost:11434
```

**faster-whisper server** (transcription):

```bash
cd backend/python
pip install -r requirements.txt
python3 faster_whisper_server.py     # listens on http://localhost:9000
```

The first run downloads the whisper model (`base` by default — change
with `WHISPER_MODEL=small python3 faster_whisper_server.py` for better
accuracy at the cost of speed).

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # defaults already point at the local AI backends
npm run dev                # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env       # VITE_BACKEND_URL=http://localhost:4000
npm run dev                 # http://localhost:5173
```

### 4. Join a meeting

Open `http://localhost:5173?room=my-meeting` in one tab, enter your name,
and join. Open the same URL in another tab (or share it with someone
else) to test multi-participant video + the AI dashboard live.

## Optional: switch to paid OpenAI backends

No code changes needed — just edit `backend/.env`:

```bash
WHISPER_BACKEND=openai
CONDENSATION_BACKEND=openai
SUMMARY_BACKEND=openai
MODERATION_BACKEND=openai
OPENAI_API_KEY=sk-...
```

You can mix and match — e.g. keep transcription local but use OpenAI for
moderation.

## Notes

- All dashboard panels show "Waiting for speech…" until real pipeline
  events arrive — nothing is ever mocked.
- The moderation ruleset in `moderationService.js` is intentionally
  minimal (a few illustrative patterns); swap in a maintained
  hate-speech/harassment lexicon or `MODERATION_BACKEND=openai` for
  production use.
- WebRTC here is a simple mesh (every peer connects to every peer),
  which is fine for small meetings. For larger rooms you'd want an SFU
  (e.g. mediasoup, LiveKit) — the signaling layer here is a natural place
  to plug that in later.
