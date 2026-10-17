// server.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";

import {
  addParticipant,
  removeParticipant,
  addTranscriptLine,
  addSpeakerPoint,
  setSummary,
  addModerationAlert,
  resetRoom,
  roomSnapshot,
  dashboardSnapshot,
  getRoom,
  addChatMessage,
  getChatHistory,
  normalizeRoomId,
} from "./roomStore.js";

import { containsBadWord } from "./badWordFilter.js";

import { transcribeAudio, getFfmpegBin } from "./services/transcriptionService.js";
import {
  condenseTranscriptStream,
  clearRoomHistory,
  clearSessionHistory,
} from "./services/condensationService.js";
import { summarizeMeeting } from "./services/summaryService.js";
import { sendMeetingSummaryEmail, emailStatus } from "./services/emailService.js";


const PORT = process.env.PORT || 4000;
/** How many new transcript lines before refreshing the rolling summary. */
const SUMMARY_EVERY_N_LINES = parseInt(process.env.SUMMARY_EVERY_N_LINES || "1", 10);

/** Avoid stacking summary API calls when STT is busy. */
const summaryInFlight = new Set();
const socketNames = new Map();

/** Merge nearby STT fragments from the same speaker before condensing. */
const utteranceBuffers = new Map();

function speakerBufferKey(roomId, speaker) {
  return `${roomId}::${speaker}`;
}

function clearSpeakerBuffer(roomId, speaker) {
  const key = speakerBufferKey(roomId, speaker);
  const buf = utteranceBuffers.get(key);
  if (buf?.timer) clearTimeout(buf.timer);
  utteranceBuffers.delete(key);
}

function clearRoomBuffers(roomId) {
  const prefix = `${roomId}::`;
  for (const [key, buf] of utteranceBuffers) {
    if (key.startsWith(prefix)) {
      if (buf?.timer) clearTimeout(buf.timer);
      utteranceBuffers.delete(key);
    }
  }
}

async function finalizeSpeakerBuffer(io, roomId, speaker) {
  const key = speakerBufferKey(roomId, speaker);
  const buf = utteranceBuffers.get(key);
  if (!buf) return;
  utteranceBuffers.delete(key);
  if (buf.timer) clearTimeout(buf.timer);

  const combined = buf.parts.join(" ").replace(/\s+/g, " ").trim();
  if (!combined) return;

  const sessionId = `${roomId}:${speaker}`;
  const { pointId } = buf;

  try {
    const iterator = condenseTranscriptStream(combined, sessionId);
    let next = await iterator.next();
    let firstToken = true;
    while (!next.done) {
      io.to(roomId).emit("dashboard:point:token", {
        speaker,
        token: next.value,
        pointId,
        replace: firstToken,
      });
      firstToken = false;
      next = await iterator.next();
    }

    const finalOutput = next.value;
    const pointText =
      (finalOutput && finalOutput.condensed_point) ||
      combined.split(/\s+/).slice(0, 22).join(" ").trim();

    if (pointText) {
      const point = addSpeakerPoint(roomId, speaker, pointText);
      io.to(roomId).emit("dashboard:point", {
        speaker,
        point: { ...point, pointId },
      });
    }

    if (finalOutput?.intent_category && finalOutput.intent_category !== "benign") {
      const alert = addModerationAlert(roomId, speaker, {
        flagged: true,
        severity: finalOutput.severity,
        reason: finalOutput.intent_category,
        text: combined,
      });
      io.to(roomId).emit("dashboard:moderation", alert);
    }
  } catch (err) {
    const point = addSpeakerPoint(roomId, speaker, combined);
    io.to(roomId).emit("dashboard:point", {
      speaker,
      point: { ...point, pointId },
    });
    io.to(roomId).emit("pipeline:error", {
      stage: "condensation",
      message: err.message,
    });
  }
}

function queueTranscriptForDashboard(io, roomId, speaker, rawText) {
  const key = speakerBufferKey(roomId, speaker);
  let buf = utteranceBuffers.get(key);
  if (!buf) {
    buf = {
      parts: [],
      pointId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timer: null,
    };
    utteranceBuffers.set(key, buf);
  }
  buf.parts.push(rawText.trim());
  const combined = buf.parts.join(" ").replace(/\s+/g, " ").trim();

  io.to(roomId).emit("dashboard:point:token", {
    speaker,
    token: combined,
    pointId: buf.pointId,
    replace: true,
  });

  if (buf.timer) clearTimeout(buf.timer);
  const words = combined.split(/\s+/).filter(Boolean).length;
  const waitMs = words >= 16 ? 400 : 1100;
  buf.timer = setTimeout(() => {
    finalizeSpeakerBuffer(io, roomId, speaker);
  }, waitMs);
}

function toNodeBuffer(audio) {
  if (!audio) return Buffer.alloc(0);
  if (Buffer.isBuffer(audio)) return audio;
  if (audio instanceof ArrayBuffer) return Buffer.from(audio);
  if (ArrayBuffer.isView(audio)) {
    return Buffer.from(audio.buffer, audio.byteOffset, audio.byteLength);
  }
  if (typeof audio === "string") return Buffer.from(audio, "base64");
  if (audio.type === "Buffer" && Array.isArray(audio.data)) return Buffer.from(audio.data);
  if (Array.isArray(audio)) return Buffer.from(audio);
  return Buffer.from(audio);
}

function resolveCorsOrigin() {
  const raw = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const allowAll =
    list.includes("*") || (process.env.CORS_ALLOW_ALL || "").toLowerCase() === "true";
  const allowHttps = (process.env.CORS_ALLOW_HTTPS || "true").toLowerCase() !== "false";
  const allowVercelPreviews =
    (process.env.CORS_ALLOW_VERCEL || "true").toLowerCase() !== "false";

  return (origin, callback) => {
    // Non-browser clients (health checks, curl) send no Origin header.
    if (!origin) return callback(null, true);
    if (allowAll || list.includes(origin)) return callback(null, true);
    if (allowVercelPreviews && /\.vercel\.app$/i.test(origin)) {
      return callback(null, true);
    }
    if (/\.railway\.app$/i.test(origin)) return callback(null, true);
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
      return callback(null, true);
    }
    if (
      /^https?:\/\/(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/i.test(
        origin
      )
    ) {
      return callback(null, true);
    }
    if (allowHttps && /^https:\/\//i.test(origin)) return callback(null, true);
    return callback(new Error(`CORS blocked for origin: ${origin}`));
  };
}

const CORS_ORIGIN = resolveCorsOrigin();

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "6mb" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"], credentials: true },
  maxHttpBufferSize: 5 * 1024 * 1024, // allow audio blobs up to 5MB
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ["polling", "websocket"],
  allowEIO3: true,
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000,
    skipMiddlewares: true,
  },
});

function maybeRefreshSummary(io, roomId) {
  const id = normalizeRoomId(roomId);
  const room = getRoom(id);
  if (
    !room ||
    room.summary.linesSinceLastSummary < SUMMARY_EVERY_N_LINES ||
    summaryInFlight.has(id)
  ) {
    return;
  }

  const transcriptSnapshot = room.transcript.slice();
  const snapshotLen = transcriptSnapshot.length;
  summaryInFlight.add(id);
  console.log(
    `[summary] room=${id} lines=${snapshotLen} since=${room.summary.linesSinceLastSummary}`
  );

  summarizeMeeting(transcriptSnapshot)
    .then((bullets) => {
      if (!bullets.length) {
        console.warn(`[summary] room=${id} empty bullets — will retry later`);
        const r = getRoom(id);
        if (r) r.summary.linesSinceLastSummary = Math.max(0, SUMMARY_EVERY_N_LINES - 1);
        return;
      }
      const summary = setSummary(id, bullets);
      const r = getRoom(id);
      if (r) {
        r.summary.linesSinceLastSummary = Math.max(0, r.transcript.length - snapshotLen);
      }
      console.log(`[summary] room=${id} bullets=${bullets.length}`);
      io.to(id).emit("summary:update", summary);
    })
    .catch((err) => {
      console.error(`[summary] room=${id} failed: ${err.message}`);
      const r = getRoom(id);
      if (r) {
        r.summary.linesSinceLastSummary = Math.max(
          r.summary.linesSinceLastSummary,
          SUMMARY_EVERY_N_LINES
        );
      }
      io.to(id).emit("pipeline:error", {
        stage: "summary",
        message: err.message,
      });
    })
    .finally(() => {
      summaryInFlight.delete(id);
    });
}

function leaveCurrentRoom(io, socket, currentRoom) {
  if (!currentRoom) return;
  const speakerName = socketNames.get(socket.id) || "Guest";
  finalizeSpeakerBuffer(io, currentRoom, speakerName);
  socket.leave(currentRoom);
  const updatedRoom = removeParticipant(currentRoom, socket.id);
  socket.to(currentRoom).emit("participant:left", { socketId: socket.id });
  if (updatedRoom?.adminSocketId) {
    io.to(currentRoom).emit("room:admin-updated", { adminSocketId: updatedRoom.adminSocketId });
  }
  clearSessionHistory(`${currentRoom}:${speakerName}`);
}

// ---------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/rooms/:roomId", (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const snapshot = roomSnapshot(roomId);
  if (!snapshot) return res.status(404).json({ error: "Room not found" });
  res.json(snapshot);
});

app.get("/api/rooms/:roomId/dashboard", (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const snapshot = dashboardSnapshot(roomId);
  if (!snapshot) return res.status(404).json({ error: "Room not found" });
  res.json(snapshot);
});

app.post("/api/rooms/:roomId/reset", (req, res) => {
  const roomId = normalizeRoomId(req.params.roomId);
  const room = resetRoom(roomId);
  clearRoomHistory(roomId);
  clearRoomBuffers(roomId);
  io.to(roomId).emit("room:reset");
  res.json(roomSnapshot(room.roomId));
});

app.get("/api/email/status", (_req, res) => {
  res.json(emailStatus());
});

app.post("/api/rooms/:roomId/email-summary", async (req, res) => {
  try {
    const roomId = normalizeRoomId(req.params.roomId);
    const { to, sentBy } = req.body || {};
    const email = typeof to === "string" ? to.trim() : "";

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid recipient email is required" });
    }

    const room = getRoom(roomId);
    if (!room) {
      return res.status(404).json({ error: "Room not found. Join the meeting first so notes can be captured." });
    }

    const speakerPoints = Object.fromEntries(
      Array.from(room.speakerPoints.entries()).map(([speaker, points]) => [
        speaker,
        points.map((p) => ({ text: p.text, ts: p.ts })),
      ])
    );

    const result = await sendMeetingSummaryEmail({
      to: email,
      roomId,
      summary: room.summary,
      speakerPoints,
      transcript: room.transcript,
      sentBy: sentBy || undefined,
    });

    res.json({ ok: true, ...result });
  } catch (err) {
    const status = err.code === "EMAIL_NOT_CONFIGURED" ? 503 : 500;
    console.error("email-summary failed:", err.message);
    res.status(status).json({ error: err.message, code: err.code || "EMAIL_SEND_FAILED" });
  }
});

// ---------------------------------------------------------------------
// Socket.io: WebRTC signaling + audio pipeline
// ---------------------------------------------------------------------

io.on("connection", (socket) => {
  let currentRoom = null;

  // ---- Room membership / WebRTC signaling ----

  socket.on("room:join", ({ roomId, name }) => {
    const id = normalizeRoomId(roomId);
    if (!id) return;

    if (currentRoom && currentRoom !== id) {
      leaveCurrentRoom(io, socket, currentRoom);
    }

    currentRoom = id;
    socketNames.set(socket.id, name || "Guest");
    socket.join(id);

    const room = addParticipant(id, socket.id, name || "Guest");
    const isAdmin = room.adminSocketId === socket.id;

    socket.emit("room:role", {
      isAdmin,
      adminSocketId: room.adminSocketId,
      gestureEnabled: room.gestureEnabled !== false,
    });

    io.to(id).emit("room:admin-updated", { adminSocketId: room.adminSocketId });

    const others = Array.from(room.participants.values()).filter(
      (p) => p.socketId !== socket.id
    );
    socket.emit("room:existing-participants", others);

    socket.to(id).emit("participant:joined", {
      socketId: socket.id,
      name: name || "Guest",
      isAdmin,
    });

    socket.emit("dashboard:snapshot", dashboardSnapshot(id));

    const chatHistory = getChatHistory(id);
    if (chatHistory.length > 0) {
      socket.emit("chat:history", chatHistory);
    }
  });

  socket.on("room:leave", () => {
    leaveCurrentRoom(io, socket, currentRoom);
    currentRoom = null;
  });

  socket.on("signal:offer", ({ to, offer }) => {
    io.to(to).emit("signal:offer", { from: socket.id, offer });
  });

  socket.on("signal:answer", ({ to, answer }) => {
    io.to(to).emit("signal:answer", { from: socket.id, answer });
  });

  socket.on("signal:ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("signal:ice-candidate", { from: socket.id, candidate });
  });

  socket.on("chat:send", ({ roomId, text }) => {
    const id = normalizeRoomId(roomId || currentRoom);
    if (!id || !text?.trim()) return;
    const senderName = socketNames.get(socket.id) || "Guest";
    const result = containsBadWord(text);

    if (result.flagged) {
      socket.emit("chat:blocked", {
        text,
        reason: "Inappropriate content detected",
      });
      const alert = addModerationAlert(id, senderName, {
        flagged: true,
        severity: result.severity,
        reason: `Bad word in chat: ${result.matchedWord}`,
        text: text,
      });
      io.to(id).emit("dashboard:moderation", alert);
      return;
    }

    const msg = addChatMessage(id, socket.id, senderName, text.trim());
    io.to(id).emit("chat:message", msg);
  });

  // ---- Speaking indicator (VAD-driven, not audio pipeline) ----

  socket.on("speaking:start", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("speaking:start", { socketId: socket.id });
  });

  socket.on("speaking:stop", () => {
    if (!currentRoom) return;
    socket.to(currentRoom).emit("speaking:stop", { socketId: socket.id });
  });

  // ---- Hand raise & Meeting controls ----

  socket.on("hand:toggle", ({ raised }) => {
    if (!currentRoom) return;
    const senderName = socketNames.get(socket.id) || "Guest";
    io.to(currentRoom).emit("hand:toggled", {
      socketId: socket.id,
      name: senderName,
      raised: !!raised,
    });
  });

  socket.on("room:mute-all", () => {
    if (!currentRoom) return;
    const senderName = socketNames.get(socket.id) || "Host";
    socket.to(currentRoom).emit("room:mute-request", {
      by: senderName,
    });
  });

  // ---- Admin Gesture & Participant Kick Controls ----

  socket.on("gesture:toggle-room", ({ enabled }) => {
    if (!currentRoom) return;
    const room = getRoom(currentRoom);
    if (!room || room.adminSocketId !== socket.id) return; // Only admin can toggle
    room.gestureEnabled = !!enabled;
    io.to(currentRoom).emit("gesture:room-state", { enabled: !!enabled });
  });

  socket.on("room:kick-participant", ({ targetSocketId }) => {
    if (!currentRoom || !targetSocketId || targetSocketId === socket.id) return;
    const room = getRoom(currentRoom);
    if (!room || room.adminSocketId !== socket.id) return; // Only admin can kick

    const targetSocket = io.sockets.sockets.get(targetSocketId);
    if (targetSocket) {
      targetSocket.emit("room:kicked", { reason: "You were removed from the meeting by the host." });
      leaveCurrentRoom(io, targetSocket, currentRoom);
    }
  });

  // ---- Audio pipeline: speech:start -> audio:chunk -> speech:end ----
  // Segments are buffered client-side by VAD and sent as one chunk per
  // utterance, so we just process on speech:end.

  socket.on("speech:start", () => {
    // no-op server side today; reserved for future streaming chunk support
  });

  socket.on(
    "audio:chunk",
    async ({ roomId, audio, mimeType, name }, ack) => {
      const id = normalizeRoomId(roomId || currentRoom);
      try {
        if (!id || !audio) {
          if (ack) ack({ ok: false, error: "missing roomId or audio" });
          return;
        }
        const speaker = name || socketNames.get(socket.id) || "Guest";
        const buffer = toNodeBuffer(audio);
        console.log(`[audio] room=${id} speaker=${speaker} bytes=${buffer.length} mime=${mimeType || "audio/webm"}`);

        const rawText = await transcribeAudio(buffer, mimeType || "audio/webm");
        if (!rawText || !rawText.trim()) {
          console.log(`[audio] skipped empty/noise transcript for ${speaker}`);
          if (ack) ack({ ok: true, skipped: "empty transcript" });
          return;
        }
        console.log(`[audio] transcript ${speaker}: ${rawText.slice(0, 120)}`);

        const line = addTranscriptLine(id, speaker, rawText);
        io.to(id).emit("transcript:update", line);
        queueTranscriptForDashboard(io, id, speaker, rawText);
        maybeRefreshSummary(io, id);

        if (ack) ack({ ok: true });
      } catch (err) {
        console.error(`[audio] transcription failed: ${err.message}`);
        io.to(id || currentRoom).emit("pipeline:error", {
          stage: "transcription",
          message: err.message,
        });
        if (ack) ack({ ok: false, error: err.message });
      }
    }
  );

  socket.on("speech:end", () => {
    // no-op; kept for symmetry / future use
  });

  // ---- Disconnect ----

  socket.on("disconnect", () => {
    leaveCurrentRoom(io, socket, currentRoom);
    currentRoom = null;
    socketNames.delete(socket.id);
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Meet backend listening on port ${PORT}`);
  console.log(`FFmpeg binary: ${getFfmpegBin()}`);
  console.log(
    `AI pipeline: transcription=Gemini (${process.env.GEMINI_VOICE_MODEL || "gemini-3.1-flash-lite"}) | condensation=Gemini (${process.env.GEMINI_TEXT_MODEL || "gemini-3.1-flash-lite"}) | summary=${process.env.SUMMARY_BACKEND || "gemini"}`
  );
});
