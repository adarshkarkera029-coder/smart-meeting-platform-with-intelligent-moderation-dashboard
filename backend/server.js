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
} from "./roomStore.js";

import { containsBadWord } from "./badWordFilter.js";

import { transcribeAudio } from "./services/transcriptionService.js";
import {
  condenseTranscriptStream,
  clearRoomHistory,
  clearSessionHistory,
} from "./services/condensationService.js";
import { summarizeMeeting } from "./services/summaryService.js";
import { sendMeetingSummaryEmail, emailStatus } from "./services/emailService.js";


const PORT = process.env.PORT || 4000;
const SUMMARY_EVERY_N_LINES = parseInt(process.env.SUMMARY_EVERY_N_LINES || "2", 10);

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

function resolveCorsOrigin() {
  const raw = process.env.CORS_ORIGIN || "http://localhost:5173,http://localhost:5174";
  const list = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (list.length <= 1) return list[0] || "http://localhost:5173";
  return list;
}

const CORS_ORIGIN = resolveCorsOrigin();

const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "6mb" }));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, methods: ["GET", "POST"], credentials: true },
  maxHttpBufferSize: 5 * 1024 * 1024, // allow audio blobs up to 5MB
});

// ---------------------------------------------------------------------
// REST endpoints
// ---------------------------------------------------------------------

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/rooms/:roomId", (req, res) => {
  const snapshot = roomSnapshot(req.params.roomId);
  if (!snapshot) return res.status(404).json({ error: "Room not found" });
  res.json(snapshot);
});

app.get("/api/rooms/:roomId/dashboard", (req, res) => {
  const snapshot = dashboardSnapshot(req.params.roomId);
  if (!snapshot) return res.status(404).json({ error: "Room not found" });
  res.json(snapshot);
});

app.post("/api/rooms/:roomId/reset", (req, res) => {
  const room = resetRoom(req.params.roomId);
  clearRoomHistory(req.params.roomId);
  clearRoomBuffers(req.params.roomId);
  io.to(req.params.roomId).emit("room:reset");
  res.json(roomSnapshot(room.roomId));
});

app.get("/api/email/status", (_req, res) => {
  res.json(emailStatus());
});

app.post("/api/rooms/:roomId/email-summary", async (req, res) => {
  try {
    const { roomId } = req.params;
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

// track speaker name per socket for convenience
const socketNames = new Map();

io.on("connection", (socket) => {
  let currentRoom = null;

  // ---- Room membership / WebRTC signaling ----

  socket.on("room:join", ({ roomId, name }) => {
    currentRoom = roomId;
    socketNames.set(socket.id, name || "Guest");
    socket.join(roomId);

    const room = addParticipant(roomId, socket.id, name || "Guest");

    // tell the newcomer about everyone already in the room
    const others = Array.from(room.participants.values()).filter(
      (p) => p.socketId !== socket.id
    );
    socket.emit("room:existing-participants", others);

    // tell everyone else about the newcomer
    socket.to(roomId).emit("participant:joined", {
      socketId: socket.id,
      name: name || "Guest",
    });

    // send full dashboard snapshot so late joiners see current state
    socket.emit("dashboard:snapshot", dashboardSnapshot(roomId));

    const chatHistory = getChatHistory(roomId);
    if (chatHistory.length > 0) {
      socket.emit('chat:history', chatHistory);
    }
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

  socket.on('chat:send', ({ roomId, text }) => {
    if (!roomId || !text?.trim()) return;
    const senderName = socketNames.get(socket.id) || 'Guest';
    const result = containsBadWord(text);
    
    if (result.flagged) {
      // DON'T broadcast - only notify sender
      socket.emit('chat:blocked', {
        text,
        reason: 'Inappropriate content detected'
      });
      // Report to admin via moderation
      const alert = addModerationAlert(roomId, senderName, {
        flagged: true,
        severity: result.severity,
        reason: `Bad word in chat: ${result.matchedWord}`,
        text: text,
      });
      io.to(roomId).emit('dashboard:moderation', alert);
      return;
    }
    
    // Clean message - broadcast to room
    const msg = addChatMessage(roomId, socket.id, senderName, text.trim());
    io.to(roomId).emit('chat:message', msg);
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

  // ---- Audio pipeline: speech:start -> audio:chunk -> speech:end ----
  // Segments are buffered client-side by VAD and sent as one chunk per
  // utterance, so we just process on speech:end.

  socket.on("speech:start", () => {
    // no-op server side today; reserved for future streaming chunk support
  });

  socket.on(
    "audio:chunk",
    async ({ roomId, audio, mimeType, name }, ack) => {
      try {
        if (!roomId || !audio) {
          if (ack) ack({ ok: false, error: "missing roomId or audio" });
          return;
        }
        const speaker = name || socketNames.get(socket.id) || "Guest";
        const buffer = Buffer.from(audio);
        console.log(`[audio] room=${roomId} speaker=${speaker} bytes=${buffer.length} mime=${mimeType || "audio/webm"}`);

        const rawText = await transcribeAudio(buffer, mimeType || "audio/webm");
        if (!rawText || !rawText.trim()) {
          console.log(`[audio] skipped empty/noise transcript for ${speaker}`);
          if (ack) ack({ ok: true, skipped: "empty transcript" });
          return;
        }
        console.log(`[audio] transcript ${speaker}: ${rawText.slice(0, 120)}`);

        const line = addTranscriptLine(roomId, speaker, rawText);
        io.to(roomId).emit("transcript:update", line);
        queueTranscriptForDashboard(io, roomId, speaker, rawText);

        // rolling summary every N new lines
        const room = getRoom(roomId);
        if (room && room.summary.linesSinceLastSummary >= SUMMARY_EVERY_N_LINES) {
          summarizeMeeting(room.transcript)
            .then((bullets) => {
              const summary = setSummary(roomId, bullets);
              io.to(roomId).emit("summary:update", summary);
            })
            .catch((err) => {
              io.to(roomId).emit("pipeline:error", {
                stage: "summary",
                message: err.message,
              });
            });
        }

        if (ack) ack({ ok: true });
      } catch (err) {
        console.error(`[audio] transcription failed: ${err.message}`);
        io.to(roomId || currentRoom).emit("pipeline:error", {
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
    if (currentRoom) {
      const speakerName = socketNames.get(socket.id) || "Guest";
      finalizeSpeakerBuffer(io, currentRoom, speakerName);
      removeParticipant(currentRoom, socket.id);
      socket.to(currentRoom).emit("participant:left", { socketId: socket.id });
      clearSessionHistory(`${currentRoom}:${speakerName}`);
    }
    socketNames.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Meet backend listening on http://localhost:${PORT}`);
  console.log(`CORS origin: ${Array.isArray(CORS_ORIGIN) ? CORS_ORIGIN.join(", ") : CORS_ORIGIN}`);
  console.log(
    `AI pipeline: transcription=Gemini-multimodal | condensation=Gemini-text (LCEL+history+trim) | summary=Gemini-text`
  );
});
