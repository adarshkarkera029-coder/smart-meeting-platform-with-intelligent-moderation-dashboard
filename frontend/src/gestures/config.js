/**
 * Configurable gesture-recognition settings.
 * Add new restricted gesture IDs here — classification lives in gestureDetector.js.
 */

/** Gestures treated as inappropriate / safety-restricted. */
export const RESTRICTED_GESTURES = [
  "middle_finger",
  "offensive_gesture",
  "threat_gesture",
];

/**
 * Confidence threshold before a restricted frame counts.
 * Tuned to 0.58 so inappropriate signs are detected reliably across camera angles.
 */
export const RESTRICTED_CONFIDENCE_THRESHOLD = 0.58;

/** General gesture badge confidence (non-safety). */
export const GESTURE_CONFIDENCE_THRESHOLD = 0.60;

/**
 * Consecutive high-confidence restricted frames required before camera cut.
 * 1 = immediate (same frame the gesture is clearly recognized).
 */
export const RESTRICTED_CONFIRM_FRAMES = 1;

/** Ignore further safety triggers for this long after one cut (ms). */
export const SAFETY_COOLDOWN_MS = 5000;

/**
 * Wait until the local camera preview is actually playing, then wait this
 * long before loading MediaPipe so getUserMedia / WebRTC can settle first.
 */
export const CAMERA_SETTLE_MS = 1200;

/**
 * Detection cadence after the camera is live. Keep this modest so the
 * meeting UI and camera preview stay smooth.
 */
export const DETECTION_INTERVAL_MS = 300;

/** How often the badge/confidence may re-render React. */
export const UI_UPDATE_INTERVAL_MS = 400;

/** Max hands analyzed; primary hand is enough for classification + safety. */
export const MAX_HANDS = 1;

/**
 * Landmarks overlay is expensive — keep off unless the user turns Debug on.
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
  offensive_gesture: "Restricted gesture",
  threat_gesture: "Restricted gesture",
  unknown: "Hand detected",
};
