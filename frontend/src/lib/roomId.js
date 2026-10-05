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
