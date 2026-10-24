// roomStore.js
// In-memory store for meeting rooms. Everything starts empty and is only
// ever populated by real pipeline events — no mock/placeholder data.

const rooms = new Map();

/** Same classroom code from host + guest must map to one Socket.io room. */
export function normalizeRoomId(roomId) {
  return String(roomId || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function createRoom(roomId) {
  return {
    roomId,
    adminSocketId: null, // First person who joins becomes admin
    firstAdminAssigned: false, // Only the first person who enters becomes admin
    gestureEnabled: true, // Controlled only by admin
    participants: new Map(), // socketId -> { socketId, name, joinedAt, isAdmin }
    transcript: [],          // [{ id, speaker, text, ts }] raw transcript lines
    speakerPoints: new Map(),// speakerName -> [{ id, text, ts }] newest first
    summary: {
      bullets: [],
      updatedAt: null,
      linesSinceLastSummary: 0,
    },
    moderation: [],          // [{ id, speaker, text, severity, reason, ts }]
    chatMessages: [],        // [{ id, senderSocketId, senderName, text, ts }]
  };
}

export function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, createRoom(roomId));
  }
  return rooms.get(roomId);
}

export function getRoom(roomId) {
  return rooms.get(roomId) || null;
}

export function addParticipant(roomId, socketId, name, camOn = true) {
  const room = getOrCreateRoom(roomId);
  let isAdmin = false;
  if (!room.firstAdminAssigned) {
    room.adminSocketId = socketId;
    room.firstAdminAssigned = true;
    isAdmin = true;
  } else {
    isAdmin = room.adminSocketId === socketId;
  }
  room.participants.set(socketId, { socketId, name, joinedAt: Date.now(), isAdmin, camOn: !!camOn });
  return room;
}

export function setParticipantCam(roomId, socketId, camOn) {
  const room = getRoom(roomId);
  if (!room) return null;
  const p = room.participants.get(socketId);
  if (p) p.camOn = !!camOn;
  return p;
}

export function removeParticipant(roomId, socketId) {
  const room = getRoom(roomId);
  if (!room) return { room: null, wasAdmin: false };
  const wasAdmin = room.adminSocketId === socketId;
  room.participants.delete(socketId);
  if (wasAdmin) {
    // Admin was the first person only. If admin leaves, do not transfer admin to anyone else.
    room.adminSocketId = null;
  }
  return { room, wasAdmin };
}

export function setRoomGesture(roomId, enabled) {
  const room = getRoom(roomId);
  if (room) {
    room.gestureEnabled = !!enabled;
  }
  return room;
}

export function isRoomAdmin(roomId, socketId) {
  const room = getRoom(roomId);
  return room ? room.adminSocketId === socketId : false;
}

export function addTranscriptLine(roomId, speaker, text) {
  const room = getOrCreateRoom(roomId);
  const line = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speaker,
    text,
    ts: Date.now(),
  };
  room.transcript.push(line);
  room.summary.linesSinceLastSummary += 1;
  return line;
}

export function addSpeakerPoint(roomId, speaker, text) {
  const room = getOrCreateRoom(roomId);
  if (!room.speakerPoints.has(speaker)) {
    room.speakerPoints.set(speaker, []);
  }
  const point = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    ts: Date.now(),
  };
  room.speakerPoints.get(speaker).unshift(point); // newest first
  return point;
}

export function getSpeakerContext(roomId, speaker, contextSize = 3) {
  const room = getRoom(roomId);
  if (!room) return [];
  const points = room.speakerPoints.get(speaker) || [];
  return points.slice(0, contextSize).map((p) => p.text);
}

export function setSummary(roomId, bullets) {
  const room = getOrCreateRoom(roomId);
  room.summary.bullets = bullets;
  room.summary.updatedAt = Date.now();
  room.summary.linesSinceLastSummary = 0;
  return room.summary;
}

export function addModerationAlert(roomId, speaker, payload) {
  const room = getOrCreateRoom(roomId);
  const alert = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    speaker,
    text: payload.text ?? "",
    severity: payload.severity ?? "low",
    reason: payload.reason ?? "benign",
    flagged: payload.flagged ?? false,
    ts: Date.now(),
  };
  room.moderation.push(alert);
  return alert;
}

export function resetRoom(roomId) {
  rooms.set(roomId, createRoom(roomId));
  return rooms.get(roomId);
}

export function addChatMessage(roomId, senderSocketId, senderName, text) {
  const room = getOrCreateRoom(roomId);
  const msg = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    senderSocketId,
    senderName,
    text,
    ts: Date.now()
  };
  room.chatMessages.push(msg);
  return msg;
}

export function getChatHistory(roomId) {
  const room = getRoom(roomId);
  return room ? room.chatMessages : [];
}

export function roomSnapshot(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  return {
    roomId: room.roomId,
    participants: Array.from(room.participants.values()),
    transcript: room.transcript,
    speakerPoints: Object.fromEntries(room.speakerPoints),
    summary: room.summary,
    moderation: room.moderation,
  };
}

export function dashboardSnapshot(roomId) {
  const room = getRoom(roomId);
  if (!room) return null;
  return {
    speakerPoints: Object.fromEntries(room.speakerPoints),
    summary: room.summary,
    moderation: room.moderation,
  };
}
