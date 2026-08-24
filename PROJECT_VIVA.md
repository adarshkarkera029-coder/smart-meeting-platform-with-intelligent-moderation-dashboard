# Meet — Project Notes (Viva / Future Reference)

Keep this file handy for vivas, reviews, and later changes.  
**Do not put API keys or Firebase secrets in this file.** Those live only in `.env` files (never commit them).

---

## 1. One-line pitch

**Meet** is a real-time video meeting app with a live AI dashboard. While people talk, the system transcribes speech, turns it into short notes per speaker, keeps a rolling meeting summary, filters bad words in chat, and can email the summary.

---

## 2. What this project is (and is not)

| It is | It is not |
|---|---|
| A mesh WebRTC video call + AI notes | A Zoom clone with recording/SFU |
| Socket.io for signaling + AI events | A server that relays video/audio media |
| Cloud Gemini STT + text (current) | The old README “local Whisper + Ollama” path (stale) |
| In-memory rooms | A database-backed production meeting service |

**Important viva point:** `README.md` still describes **faster-whisper + Ollama**. The **running code** uses **Google Gemini via LangChain**. Mention both: original design vs current implementation.

---

## 3. Tech stack

### Frontend (`frontend/`)
| Piece | Technology | Why |
|---|---|---|
| UI | React 18 + Vite 5 | Fast SPA, HMR |
| Styling | Single CSS file `src/styles/index.css` | Spotify-inspired 2026 dark UI + light mode |
| Realtime | `socket.io-client` | Join room, chat, dashboard events |
| Video | WebRTC (`RTCPeerConnection`) | Peer-to-peer A/V |
| Auth | Firebase Auth | Email, Google, GitHub, Microsoft, phone OTP, guest |
| Effects | `webgl-fluid` | Fluid cursor on auth/join |

**Frontend port:** `http://localhost:5173`  
**Env:** `frontend/.env` → `VITE_BACKEND_URL`, `VITE_FIREBASE_*`

### Backend (`backend/`)
| Piece | Technology | Why |
|---|---|---|
| HTTP | Express | Health, room snapshot, email, reset |
| Realtime | Socket.io on Node `http` server | Signaling + `audio:chunk` + chat |
| AI | LangChain + `@langchain/google-genai` | STT, condensation, summary |
| Schema | Zod | Structured condensation JSON |
| Email | Nodemailer (Resend SMTP or Gmail SMTP) | Send summary |
| State | `roomStore.js` (in-memory `Map`) | Rooms, transcript, points, chat |

**Backend port:** `http://localhost:4000`  
**Env:** `backend/.env`

### Auth (Firebase)
Providers configured in `frontend/src/lib/firebase.js`:
- Email / password
- Google
- GitHub
- Microsoft (`OAuthProvider("microsoft.com")`)
- Phone OTP
- Guest (local, no Firebase user required)

If a method is not enabled in Firebase Console → `auth/operation-not-allowed`.

---

## 4. Models — which one is used where

**Current production path: both Gemini models default to `gemini-3.1-flash-lite`.**

| Job | File | Env key | Model (default) | Input | Output |
|---|---|---|---|---|---|
| **Speech-to-text (STT)** | `backend/services/transcriptionService.js` | `GEMINI_API_KEY_VOICE` + `GEMINI_VOICE_MODEL` | `gemini-3.1-flash-lite` | Audio blob (webm/opus) as multimodal `media` | Plain transcript text or empty if noise |
| **Condensation + intent** | `backend/services/condensationService.js` | `GEMINI_API_KEY_TEXT` + `GEMINI_TEXT_MODEL` | `gemini-3.1-flash-lite` | Raw transcript + per-speaker chat history | JSON: `condensed_point`, `intent_category`, `severity` |
| **Rolling summary** | `backend/services/summaryService.js` | same text key/model | `gemini-3.1-flash-lite` | Full transcript so far | 3–6 bullet points |
| **Chat filter** | `backend/badWordFilter.js` | none | **No LLM** — keyword list | Chat text | Flag + severity |
| **Intent on long utterances** | same condensation call | text Gemini | LLM classify | Utterance | `benign` / `aggressive` / `harassment` / `profanity` / `threat` |

### LangChain building blocks (say these in viva)

| Concept | Where used | What it does |
|---|---|---|
| `ChatGoogleGenerativeAI` | All 3 AI services | Gemini chat model wrapper |
| `HumanMessage` with `type: "media"` | Transcription | Sends audio as multimodal content |
| `ChatPromptTemplate` + `MessagesPlaceholder("history")` | Condensation | Prompt + conversation memory |
| `RunnableWithMessageHistory` | Condensation | Auto-injects per-speaker history |
| `InMemoryChatMessageHistory` | Condensation | History store in RAM |
| `trimMessages` | Condensation | Keeps ~600 tokens of last turns |
| `PromptTemplate` + `StringOutputParser` | Summary | LCEL: prompt → model → string |
| `chain.stream()` | Condensation stream | Token-by-token dashboard typewriter |
| Zod schema (in service) | Condensation | JSON shape for point + intent |

**Session key:** `sessionId = "{roomId}:{speakerName}"`  
Cleared on disconnect (`clearSessionHistory`) or room reset (`clearRoomHistory`).

### Alternate / unused AI (know for “future work” questions)

| Backend | File | Status |
|---|---|---|
| Local **faster-whisper** (`base` by default) | `backend/python/faster_whisper_server.py` port **9000** | Code exists; **Node STT does not call it** today |
| **Ollama / llama3.2** | mentioned in README | Not wired in current condensation/summary |
| OpenAI Whisper / GPT | README optional env | Not used in current services |

`.env` still has `WHISPER_BACKEND=gemini` etc., but `transcriptionService.js` **always** calls Gemini. Good viva answer: “Config leftovers from the older multi-backend design.”

---

## 5. End-to-end AI pipeline (mic → dashboard)

```
Mic
 → getUserMedia (48 kHz, noise suppression, AEC, AGC)
 → useVAD.js (RMS + peak, speech confirm, silence hangover)
 → MediaRecorder (webm/opus, 128 kbps, 250 ms timeslice)
 → Socket.io  audio:chunk
 → transcribeAudio()          [Gemini VOICE]   ← blocking
 → emit transcript:update
 → immediately show raw text on dashboard (token replace)
 → if ≤12 words: save as point (skip 2nd LLM)
 → else: condenseTranscriptStream() [Gemini TEXT] + typewriter
 → every N transcript lines: summarizeMeeting() [Gemini TEXT]
 → UI: SpeakerCard + SummaryPanel
```

### Latency tunings (current)

| Setting | Value | File | Why |
|---|---|---|---|
| Speech confirm | ~90 ms | `useVAD.js` | Start recording quickly |
| Silence hangover | ~420 ms | `useVAD.js` | Don’t wait a long pause |
| Max utterance | ~4.5 s | `useVAD.js` | Split long talk so notes appear mid-speech |
| Short skip | ≤12 words | `server.js` | Skip condensation LLM |
| Summary every | **4** lines | `SUMMARY_EVERY_N_LINES` | Less API contention (README said 2) |

### Dashboard events (Socket.io)

| Event | Direction | Meaning |
|---|---|---|
| `room:join` | client → server | Join WebRTC room + get snapshot |
| `audio:chunk` | client → server | One speech blob |
| `transcript:update` | server → room | Raw STT line (UI does not show a full transcript panel) |
| `dashboard:point:token` | server → room | Streaming / instant text (`replace` flag) |
| `dashboard:point` | server → room | Final condensed (or verbatim) bullet |
| `summary:update` | server → room | Rolling bullets |
| `dashboard:moderation` | server → room | Intent / bad-word alert |
| `dashboard:snapshot` | server → joiner | Late-join state |
| `chat:send` / `chat:message` / `chat:blocked` | both | Chat + filter |
| `signal:offer` / `answer` / `ice-candidate` | both | WebRTC signaling only |

---

## 6. WebRTC (video/audio media)

**Topology:** mesh — every peer connects to every other peer.  
**Signaling:** Socket.io only (SDP + ICE).  
**Media path:** browser ↔ browser (STUN `stun:stun.l.google.com:19302`).  
**Server never sees camera/mic frames** except the **separate** VAD-gated audio blobs sent for STT.

| Hook | Role |
|---|---|
| `useSocket.js` | Connects to `VITE_BACKEND_URL` or `localhost:4000`, reconnects |
| `useWebRTC.js` | `RTCPeerConnection`, offers/answers, remote streams |
| `useVAD.js` | Energy-based VAD (not ML) |
| `useAudioPipeline.js` | Recorder start/stop, min size/duration filters |

**Camera toggle bug (fixed):** `<video>` was unmounted when cam off, so remounting showed a blank frame. Fix: keep `<video>` mounted, hide it, call `play()` when cam returns (`VideoTile.jsx`).

**Viva line:** “Signaling vs media. Socket.io is the control plane; WebRTC is the media plane.”

**Scale limit:** mesh is O(n²) connections. Larger rooms need an **SFU** (mediasoup, LiveKit, Janus).

---

## 7. Features checklist

| Feature | How it works |
|---|---|
| Multi-user video | WebRTC mesh |
| Mute / camera | Enable/disable tracks |
| AI listening toggle | Enables VAD + recorder |
| Speaker notes | STT → (optional) condensation |
| Live typewriter | Streamed tokens |
| Rolling summary | Gemini every N lines |
| Chat | Socket.io + `badWordFilter` (blocked messages not broadcast) |
| Invite link / room code | URL `?room=` + copy/share |
| Calendar modal | UI to open calendar (schedule helper) |
| Email summary | `POST` via `emailService.js` (Resend or SMTP) |
| Dark / light theme | `ThemeContext` + `data-theme` + `localStorage` `meet_theme` |
| Responsive phone | CSS `@media (max-width: 768px)` only; desktop unchanged |
| Guest login | Local user, no Firebase |

---

## 8. Project structure (what to open if asked)

```
meet-app/
  frontend/
    src/App.jsx                 Join + meeting shell, socket listeners
    src/hooks/useWebRTC.js      Peers
    src/hooks/useVAD.js         Speech start/end
    src/hooks/useAudioPipeline.js  Send audio
    src/lib/AuthContext.jsx     Firebase + guest
    src/lib/ThemeContext.jsx    Theme
    src/components/             Video, chat, dashboard, auth, modals
    src/styles/index.css        All UI (Spotify-style + light contrast + mobile)
  backend/
    server.js                   Express + Socket.io + pipeline
    roomStore.js                In-memory rooms
    badWordFilter.js            Chat lexicon
    services/transcriptionService.js
    services/condensationService.js
    services/summaryService.js
    services/emailService.js
    python/faster_whisper_server.py   Optional local STT (unused by Node now)
  start.sh                      Helper to start services
```

---

## 9. How to run (local)

```bash
# Terminal 1 — backend
cd backend && npm install && npm run dev
# http://localhost:4000

# Terminal 2 — frontend
cd frontend && npm install && npm run dev
# http://localhost:5173
```

Join: open two tabs with the same room code (or `?room=demo`).  
Need **HTTPS or localhost** for `getUserMedia`.  
If `ERR_CONNECTION_REFUSED` on 5173: Vite is not running — start frontend again.

---

## 10. Environment variables (names only)

### Backend
| Variable | Purpose |
|---|---|
| `PORT` | Default 4000 |
| `CORS_ORIGIN` | `http://localhost:5173` (and 5174) |
| `GEMINI_API_KEY_VOICE` | STT |
| `GEMINI_API_KEY_TEXT` | Condensation + summary |
| `GEMINI_VOICE_MODEL` / `GEMINI_TEXT_MODEL` | Default `gemini-3.1-flash-lite` |
| `SUMMARY_EVERY_N_LINES` | Currently **4** |
| `RESEND_API_KEY` / `SMTP_*` | Email |

### Frontend
| Variable | Purpose |
|---|---|
| `VITE_BACKEND_URL` | Socket + REST base |
| `VITE_FIREBASE_*` | Auth app config |

---

## 11. Likely viva questions + short answers

**Q. Why two Gemini API keys (VOICE vs TEXT)?**  
A. Separation of STT vs language tasks; can use different quotas/models. In this project they can be the same key.

**Q. Why Flash Lite, not Pro?**  
A. Speed and cost for real-time dashboard. Accuracy vs latency tradeoff. Can switch via env.

**Q. Why not stream STT?**  
A. Gemini STT is a full-blob `invoke()`. Streaming is on condensation. First dashboard text appears after STT finishes.

**Q. How do you avoid sending silence?**  
A. Client VAD + min duration/bytes; server skips tiny buffers and `isNoiseTranscript()` / `NO_SPEECH`.

**Q. How is speaker identity known?**  
A. Display name from join/auth, stored on socket (`socketNames`). Not speaker diarization of a mixed audio file — each client sends their own mic.

**Q. Is video processed by AI?**  
A. No. Only audio segments for STT.

**Q. Where is data stored?**  
A. RAM in `roomStore`. Lost on server restart. Auth users live in Firebase.

**Q. How is chat safer than the dashboard?**  
A. Chat is filtered **before broadcast**. Flagged chat is not sent to others; sender gets `chat:blocked`.

**Q. Difference between mesh and SFU?**  
A. Mesh: each pair has a P2P link. SFU: everyone sends to a media server that forwards. Mesh is simpler, worse at scale.

**Q. What is ICE / STUN?**  
A. ICE finds a path through NAT. STUN tells a peer its public address. TURN (not used) would relay if P2P fails.

**Q. What is LCEL?**  
A. LangChain Expression Language — pipe `prompt | model | parser`. Used in summary; condensation uses prompt + history + stream.

**Q. Why `trimMessages`?**  
A. Stop unbounded history from slowing/costing every condensation call.

**Q. Why skip condensation for short utterances?**  
A. Prompt already said “repeat short text exactly.” Extra LLM only added delay.

**Q. README vs code mismatch?**  
A. Project started as local Whisper + Ollama; later assignment/task moved to LangChain + Gemini.

**Q. Limitations**  
A. In-memory state, mesh scale, STT needs pause or 4.5s split, Firebase methods must be enabled, email needs Resend/SMTP, no persistent recordings, Gemini needs network.

**Q. Security**  
A. Don’t commit `.env`. CORS restricted. Chat filter is lexicon (bypassable). No auth on Socket.io rooms (anyone with room code can join).

---

## 12. UI notes (if they ask design)

- **Dark theme:** Spotify-like — black canvas, green `#1ED760`, bottom “now playing” player bar.
- **AI listen:** Green play/pause in the player bar.
- **Light theme:** Same layout; extra contrast rules so icons/buttons stay visible.
- **Mobile (`max-width: 768px`):** Top icon bar, stacked video + dashboard, player bar; desktop CSS not changed.

---

## 13. REST endpoints (backend)

| Method | Path | Use |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/rooms/:roomId` | Room snapshot |
| GET | `/api/rooms/:roomId/dashboard` | Dashboard snapshot |
| POST | `/api/rooms/:roomId/reset` | Clear room + LangChain history |
| POST | email helper in `server.js` / `emailService` | Send summary mail |

---

## 14. Quick memory sheet

| Item | Value |
|---|---|
| Frontend | React + Vite :5173 |
| Backend | Express + Socket.io :4000 |
| STT model | Gemini **gemini-3.1-flash-lite** (voice key) |
| Text model | Gemini **gemini-3.1-flash-lite** (text key) |
| Framework | LangChain (`ChatGoogleGenerativeAI`) |
| Video | WebRTC mesh + STUN |
| Auth | Firebase + guest |
| Chat filter | Local word list |
| State | In-memory |
| Summary trigger | Every **4** new transcript lines |

---

*Last aligned with the codebase in this repo. If you change models, update this table and `.env.example` together.*
