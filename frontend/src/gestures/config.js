/**
 * Configurable gesture-recognition settings.
 * Add new restricted gesture IDs here — classification lives in gestureDetector.js.
 */

/** Gestures treated as inappropriate / safety-restricted. */
export const RESTRICTED_GESTURES = [
  "middle_finger",
  // Add more IDs later, e.g. "obscene_gesture_2"
];

/**
 * High confidence before a restricted frame counts.
 * Match the on-screen gesture badge so: if UI shows restricted → camera off now.
 */
export const RESTRICTED_CONFIDENCE_THRESHOLD = 0.65;

/** General gesture badge confidence (non-safety). */
export const GESTURE_CONFIDENCE_THRESHOLD = 0.65;

/**
 * Consecutive high-confidence restricted frames required before camera cut.
 * 1 = immediate (same frame the gesture is clearly recognized).
 */
export const RESTRICTED_CONFIRM_FRAMES = 1;

/** Ignore further safety triggers for this long after one cut (ms). */
export const SAFETY_COOLDOWN_MS = 5000;

/**
 * Detection cadence. Lower = faster restricted response.
 * ~25ms ≈ 40 Hz for near-instant safety reaction.
 */
export const DETECTION_INTERVAL_MS = 25;

/** Max hands analyzed; we always pick the highest-score hand as primary. */
export const MAX_HANDS = 2;

/**
 * Set true (or toggle in UI) to show landmarks diagnostics.
 * Easy to leave off for production.
 */
export const DEFAULT_DEBUG_MODE = false;

/** CDN assets for MediaPipe Hand Landmarker (client-side only). */
export const MEDIAPIPE = {
  wasmRoot:
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm",
  modelUrl:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
};

export const GESTURE_LABELS = {
  none: "No hand detected",
  open_palm: "Open palm",
  fist: "Fist",
  thumbs_up: "Thumbs up",
  victory: "Victory",
  pointing: "Pointing",
  middle_finger: "Restricted gesture",
  unknown: "Hand detected",
};
