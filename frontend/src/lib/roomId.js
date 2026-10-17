/** Keep in sync with backend/roomStore.js normalizeRoomId. */
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

/** Generates an auto-generated 6-digit numeric room code (e.g. "582914"). */
export function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}
