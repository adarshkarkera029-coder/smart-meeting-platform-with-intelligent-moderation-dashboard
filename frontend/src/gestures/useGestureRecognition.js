/**
 * useGestureRecognition.js
 *
 * Client-side hand detection + restricted-gesture camera safety.
 * Uses the existing WebRTC local <video> — no second camera stream.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_DEBUG_MODE,
  DETECTION_INTERVAL_MS,
  GESTURE_LABELS,
  RESTRICTED_CONFIDENCE_THRESHOLD,
} from "./config.js";
import {
  detectFromVideo,
  disposeHandLandmarker,
  getHandLandmarker,
} from "./gestureDetector.js";
import { createRestrictedGestureDetector } from "./restrictedGestureDetector.js";
import { createSafetyCameraController } from "./safetyCameraController.js";

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
  const [gesture, setGesture] = useState("none");
  const [confidence, setConfidence] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [safetyNotice, setSafetyNotice] = useState(null);
  const [debugInfo, setDebugInfo] = useState({
    handDetected: false,
    landmarks: null,
    indexTip: null,
  });

  const landmarkerRef = useRef(null);
  const restrictedRef = useRef(createRestrictedGestureDetector());
  const rafRef = useRef(null);
  const lastDetectAtRef = useRef(0);
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

  useEffect(() => {
    if (!gestureEnabled) {
      setStatus((s) => (s === "ready" || s === "unavailable" ? s : "idle"));
      return;
    }

    let cancelled = false;
    if (!landmarkerRef.current) {
      setStatus("loading");
      setStatusMessage("Loading hand model…");
    }

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

    return () => {
      cancelled = true;
    };
  }, [gestureEnabled]);

  useEffect(() => {
    const shouldRun = gestureEnabled && camOn && status === "ready";

    if (!shouldRun) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      if (!gestureEnabled || !camOn) {
        setGesture("none");
        setConfidence(0);
        setHoldProgress(0);
        if (!gestureEnabled) {
          restrictedRef.current.reset();
          setDebugInfo({
            handDetected: false,
            landmarks: null,
            indexTip: null,
          });
        }
      }
      return;
    }

    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      rafRef.current = requestAnimationFrame(tick);

      const now = performance.now();
      if (now - lastDetectAtRef.current < DETECTION_INTERVAL_MS) return;
      lastDetectAtRef.current = now;

      const video = videoRef?.current;
      const lm = landmarkerRef.current;
      if (!video || !lm) return;

      let detection;
      try {
        detection = detectFromVideo(lm, video, now);
      } catch (err) {
        console.warn("[gesture] detect error:", err?.message);
        return;
      }

      const { gesture: g, confidence: c, indexTip, landmarks } = detection;

      setGesture(g);
      setConfidence(c);

      const { safetyEnabled: safetyOn, debugMode: debugOn } = enabledRef.current;

      if (safetyOn) {
        const result = restrictedRef.current.update(g, c);
        setHoldProgress(result.holdProgress);
        if (result.triggered) {
          const cut = safetyRef.current.disableCameraForRestrictedGesture(result.gesture);
          if (cut) {
            setSafetyNotice({
              message: "Restricted gesture detected — camera turned off.",
              gesture: result.gesture,
              at: Date.now(),
            });
            setHoldProgress(0);
          }
        }
      } else {
        restrictedRef.current.reset();
        setHoldProgress(0);
      }

      if (debugOn) {
        setDebugInfo({
          handDetected: g !== "none",
          landmarks: landmarks || null,
          indexTip: indexTip || null,
        });
      }
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [gestureEnabled, camOn, status, videoRef]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      disposeHandLandmarker();
    };
  }, []);

  return {
    status,
    statusMessage,
    gesture,
    gestureLabel: GESTURE_LABELS[gesture] || gesture,
    confidence,
    holdProgress,
    safetyNotice,
    clearSafetyNotice,
    reenableCamera,
    debugInfo,
    restrictedThreshold: RESTRICTED_CONFIDENCE_THRESHOLD,
  };
}
