/**
 * useGestureRecognition.js
 *
 * Client-side hand detection + restricted-gesture camera safety.
 * Features stay off until the local camera preview is playing, then arm.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CAMERA_SETTLE_MS,
  DEFAULT_DEBUG_MODE,
  DETECTION_INTERVAL_MS,
  GESTURE_LABELS,
  RESTRICTED_CONFIDENCE_THRESHOLD,
  UI_UPDATE_INTERVAL_MS,
} from "./config.js";
import {
  detectFromVideo,
  disposeHandLandmarker,
  getHandLandmarker,
} from "./gestureDetector.js";
import { createRestrictedGestureDetector } from "./restrictedGestureDetector.js";
import { createSafetyCameraController } from "./safetyCameraController.js";

function cameraPreviewIsLive(stream, camOn, video) {
  if (!camOn || !stream) return false;
  const trackLive = stream
    .getVideoTracks()
    .some((t) => t.enabled && t.readyState === "live");
  if (!trackLive) return false;
  if (!video) return false;
  return video.readyState >= 2 && video.videoWidth > 0;
}

export function useGestureRecognition({
  videoRef,
  stream,
  camOn,
  setCamOn,
  gestureEnabled,
  safetyEnabled,
  debugMode = DEFAULT_DEBUG_MODE,
}) {
  const [status, setStatus] = useState("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [armed, setArmed] = useState(false);
  const [gesture, setGesture] = useState("none");
  const [confidence, setConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [safetyNotice, setSafetyNotice] = useState(null);

  const landmarkerRef = useRef(null);
  const restrictedRef = useRef(createRestrictedGestureDetector());
  const timerRef = useRef(null);
  const lastUiAtRef = useRef(0);
  const lastUiRef = useRef({ gesture: "none", confidencePct: 0, hold: 0 });
  const debugInfoRef = useRef({
    handDetected: false,
    landmarks: null,
    indexTip: null,
  });
  const enabledRef = useRef({
    gestureEnabled,
    safetyEnabled,
    camOn,
    debugMode,
  });

  const streamRef = useRef(stream);
  const camOnRef = useRef(camOn);
  const setCamOnRef = useRef(setCamOn);
  streamRef.current = stream;
  camOnRef.current = camOn;
  setCamOnRef.current = setCamOn;
  enabledRef.current = {
    gestureEnabled,
    safetyEnabled,
    camOn,
    debugMode,
  };

  const safetyRef = useRef(null);
  if (!safetyRef.current) {
    safetyRef.current = createSafetyCameraController({
      getStream: () => streamRef.current,
      getCamOn: () => camOnRef.current,
      setCamOn: (v) => setCamOnRef.current(v),
    });
  }

  const clearSafetyNotice = useCallback(() => setSafetyNotice(null), []);

  const reenableCamera = useCallback(() => {
    safetyRef.current.enableCamera();
    setSafetyNotice(null);
    restrictedRef.current.reset();
  }, []);

  const resetUi = useCallback(() => {
    setGesture("none");
    setConfidence(0);
    setHoldProgress(0);
    lastUiRef.current = { gesture: "none", confidencePct: 0, hold: 0 };
    debugInfoRef.current = {
      handDetected: false,
      landmarks: null,
      indexTip: null,
    };
  }, []);

  // Arm only after the camera preview is actually on-screen.
  useEffect(() => {
    if (!gestureEnabled || !camOn || !stream) {
      setArmed(false);
      return undefined;
    }

    let cancelled = false;
    let settleTimer = 0;
    let pollTimer = 0;

    const tryArm = () => {
      if (cancelled || settleTimer) return;
      if (!cameraPreviewIsLive(stream, camOn, videoRef?.current)) return;
      settleTimer = window.setTimeout(() => {
        if (!cancelled) setArmed(true);
      }, CAMERA_SETTLE_MS);
    };

    pollTimer = window.setInterval(tryArm, 200);
    const video = videoRef?.current;
    video?.addEventListener("playing", tryArm);
    video?.addEventListener("loadeddata", tryArm);
    tryArm();

    return () => {
      cancelled = true;
      window.clearInterval(pollTimer);
      window.clearTimeout(settleTimer);
      video?.removeEventListener("playing", tryArm);
      video?.removeEventListener("loadeddata", tryArm);
      setArmed(false);
    };
  }, [gestureEnabled, camOn, stream, videoRef]);

  // Load the model only after the camera has been armed.
  useEffect(() => {
    if (!gestureEnabled) {
      setStatus("idle");
      setStatusMessage("");
      return undefined;
    }

    if (!armed) {
      setStatus("waiting");
      setStatusMessage("Waiting for camera…");
      return undefined;
    }

    let cancelled = false;

    if (landmarkerRef.current) {
      setStatus("ready");
      setStatusMessage("");
      return undefined;
    }

    setStatus("loading");
    setStatusMessage("Loading hand model…");

    const startLoad = () => {
      if (cancelled) return;
      getHandLandmarker()
        .then((lm) => {
          if (cancelled) return;
          landmarkerRef.current = lm;
          setStatus("ready");
          setStatusMessage("");
        })
        .catch((err) => {
          if (cancelled) return;
          console.warn("[gesture] model unavailable:", err?.message);
          landmarkerRef.current = null;
          setStatus("unavailable");
          setStatusMessage("AI gesture detection is unavailable on this device.");
        });
    };

    const idleId =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(startLoad, { timeout: 2500 })
        : window.setTimeout(startLoad, 400);

    return () => {
      cancelled = true;
      if (typeof cancelIdleCallback === "function" && typeof idleId === "number") {
        cancelIdleCallback(idleId);
      } else {
        window.clearTimeout(idleId);
      }
    };
  }, [gestureEnabled, armed]);

  useEffect(() => {
    const shouldRun = gestureEnabled && armed && camOn && status === "ready";

    if (!shouldRun) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (!gestureEnabled || !camOn || !armed) {
        resetUi();
        if (!gestureEnabled) restrictedRef.current.reset();
      }
      return undefined;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;

      const video = videoRef?.current;
      const lm = landmarkerRef.current;
      if (video && lm && video.readyState >= 2) {
        let detection;
        try {
          detection = detectFromVideo(lm, video, performance.now());
        } catch (err) {
          console.warn("[gesture] detect error:", err?.message);
          detection = null;
        }

        if (detection) {
          const { gesture: g, confidence: c, indexTip, landmarks } = detection;
          const { safetyEnabled: safetyOn, debugMode: debugOn } = enabledRef.current;

          let hold = 0;
          if (safetyOn) {
            const result = restrictedRef.current.update(g, c);
            hold = result.holdProgress;
            if (result.triggered) {
              const cut = safetyRef.current.disableCameraForRestrictedGesture(result.gesture);
              if (cut) {
                setSafetyNotice({
                  message: "Restricted gesture detected — camera turned off.",
                  gesture: result.gesture,
                  at: Date.now(),
                });
                hold = 0;
              }
            }
          } else {
            restrictedRef.current.reset();
          }

          if (debugOn) {
            debugInfoRef.current = {
              handDetected: g !== "none",
              landmarks: landmarks || null,
              indexTip: indexTip || null,
            };
          } else if (debugInfoRef.current.landmarks || debugInfoRef.current.indexTip) {
            debugInfoRef.current = {
              handDetected: g !== "none",
              landmarks: null,
              indexTip: null,
            };
          }

          const now = performance.now();
          const pct = Math.round((c || 0) * 20) / 20;
          const holdBucket = Math.round((hold || 0) * 10) / 10;
          const prev = lastUiRef.current;
          const due = now - lastUiAtRef.current >= UI_UPDATE_INTERVAL_MS;
          const changed =
            prev.gesture !== g || prev.confidencePct !== pct || prev.hold !== holdBucket;

          if (changed || due) {
            lastUiAtRef.current = now;
            lastUiRef.current = { gesture: g, confidencePct: pct, hold: holdBucket };
            if (prev.gesture !== g) setGesture(g);
            if (prev.confidencePct !== pct) setConfidence(c);
            if (prev.hold !== holdBucket) setHoldProgress(hold);
          }
        }
      }

      timerRef.current = setTimeout(tick, DETECTION_INTERVAL_MS);
    };

    timerRef.current = setTimeout(tick, DETECTION_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gestureEnabled, armed, camOn, status, videoRef, resetUi]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      disposeHandLandmarker();
    };
  }, []);

  return {
    status,
    statusMessage,
    armed,
    gesture,
    gestureLabel: GESTURE_LABELS[gesture] || gesture,
    confidence,
    holdProgress,
    safetyNotice,
    clearSafetyNotice,
    reenableCamera,
    debugInfoRef,
    restrictedThreshold: RESTRICTED_CONFIDENCE_THRESHOLD,
  };
}
