/**
 * gestureDetector.js
 *
 * Client-side MediaPipe Hand Landmarker wrapper.
 * - Loads the model once (lazy).
 * - Classifies static hand poses from 21 landmarks.
 * - Never uploads frames; all CV runs in the browser.
 *
 * Multi-hand policy: when 2 hands are visible we always use the
 * highest-score hand as the "primary" hand for gesture classification.
 */

import {
  GESTURE_CONFIDENCE_THRESHOLD,
  MAX_HANDS,
  MEDIAPIPE,
} from "./config.js";

// MediaPipe landmark indices
const TIP = { thumb: 4, index: 8, middle: 12, ring: 16, pinky: 20 };
const PIP = { thumb: 3, index: 6, middle: 10, ring: 14, pinky: 18 };
const MCP = { thumb: 2, index: 5, middle: 9, ring: 13, pinky: 17 };
const WRIST = 0;

let landmarkerPromise = null;

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

/** Finger extended if tip is clearly farther from wrist than PIP. */
function isExtended(landmarks, tipIdx, pipIdx) {
  const wrist = landmarks[WRIST];
  const tip = landmarks[tipIdx];
  const pip = landmarks[pipIdx];
  return dist(wrist, tip) > dist(wrist, pip) * 1.15;
}

/** Thumb uses distance from MCP (works for mirrored selfie cams). */
function isThumbExtended(landmarks) {
  const tip = landmarks[TIP.thumb];
  const ip = landmarks[PIP.thumb];
  const mcp = landmarks[MCP.thumb];
  return dist(mcp, tip) > dist(mcp, ip) * 1.2;
}

/**
 * Classify a static pose from one hand's landmarks.
 * Returns { gesture, confidence } where confidence is a heuristic 0–1.
 */
export function classifyHandPose(landmarks, handednessScore = 0.9) {
  if (!landmarks || landmarks.length < 21) {
    return { gesture: "none", confidence: 0 };
  }

  const thumb = isThumbExtended(landmarks);
  const index = isExtended(landmarks, TIP.index, PIP.index);
  const middle = isExtended(landmarks, TIP.middle, PIP.middle);
  const ring = isExtended(landmarks, TIP.ring, PIP.ring);
  const pinky = isExtended(landmarks, TIP.pinky, PIP.pinky);

  const extendedCount = [thumb, index, middle, ring, pinky].filter(Boolean).length;
  const base = Math.min(0.98, 0.55 + handednessScore * 0.4);

  // Restricted: middle up, others mostly down
  if (middle && !index && !ring && !pinky) {
    return { gesture: "middle_finger", confidence: base };
  }

  if (thumb && !index && !middle && !ring && !pinky) {
    return { gesture: "thumbs_up", confidence: base };
  }

  if (index && middle && !ring && !pinky) {
    return { gesture: "victory", confidence: base };
  }

  if (index && !middle && !ring && !pinky) {
    return { gesture: "pointing", confidence: base * 0.95 };
  }

  if (extendedCount >= 4) {
    return { gesture: "open_palm", confidence: base };
  }

  if (extendedCount <= 1 && !thumb) {
    return { gesture: "fist", confidence: base * 0.9 };
  }

  return { gesture: "unknown", confidence: base * 0.7 };
}

async function createLandmarker() {
  const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");
  const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE.wasmRoot);
  try {
    return await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE.modelUrl,
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: MAX_HANDS,
    });
  } catch (gpuErr) {
    console.warn("[gesture] GPU landmarker failed, trying CPU:", gpuErr?.message);
    return HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE.modelUrl,
        delegate: "CPU",
      },
      runningMode: "VIDEO",
      numHands: MAX_HANDS,
    });
  }
}

/** Lazy singleton loader. Falls back to CPU if GPU init fails. */
export async function getHandLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker();
  }
  return landmarkerPromise;
}

/**
 * Run detection on a <video> element (must have current frame ready).
 */
export function detectFromVideo(landmarker, videoEl, timestampMs) {
  if (!landmarker || !videoEl || videoEl.readyState < 2) {
    return {
      gesture: "none",
      confidence: 0,
      landmarks: null,
      indexTip: null,
      handCount: 0,
      aboveThreshold: false,
    };
  }

  const result = landmarker.detectForVideo(videoEl, timestampMs);
  const hands = result?.landmarks || [];
  const scores = result?.handednesses || [];

  if (!hands.length) {
    return {
      gesture: "none",
      confidence: 0,
      landmarks: null,
      indexTip: null,
      handCount: 0,
      aboveThreshold: false,
    };
  }

  // Primary hand = highest handedness score (consistent multi-hand policy)
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < scores.length; i++) {
    const s = scores[i]?.[0]?.score ?? 0;
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }

  const landmarks = hands[bestIdx];
  const pose = classifyHandPose(landmarks, bestScore || 0.85);
  const tip = landmarks[TIP.index];

  return {
    ...pose,
    landmarks,
    indexTip: tip ? { x: tip.x, y: tip.y } : null,
    handCount: hands.length,
    aboveThreshold: pose.confidence >= GESTURE_CONFIDENCE_THRESHOLD,
  };
}

/** Release the singleton (call on meeting leave). */
export async function disposeHandLandmarker() {
  if (!landmarkerPromise) return;
  try {
    const lm = await landmarkerPromise;
    lm?.close?.();
  } catch {
    /* ignore */
  }
  landmarkerPromise = null;
}
