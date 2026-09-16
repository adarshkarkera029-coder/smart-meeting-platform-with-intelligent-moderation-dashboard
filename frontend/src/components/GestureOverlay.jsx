import React, { useEffect, useRef } from "react";

/**
 * Overlay on the local (mirrored) video preview:
 * gesture label, confidence, and optional debug landmarks.
 */
export default function GestureOverlay({
  visible,
  gestureLabel,
  confidence,
  holdProgress = 0,
  showBadge = true,
  debugMode = false,
  debugInfo = null,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visible) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;

    const paint = () => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      if (w < 2 || h < 2) return;

      const cw = Math.floor(w * dpr);
      const ch = Math.floor(h * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const toX = (nx) => (1 - nx) * w;
      const toY = (ny) => ny * h;

      if (debugMode && debugInfo) {
        if (debugInfo.landmarks?.length) {
          ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
          for (const lm of debugInfo.landmarks) {
            ctx.beginPath();
            ctx.arc(toX(lm.x), toY(lm.y), 2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (debugInfo.indexTip) {
          ctx.beginPath();
          ctx.fillStyle = "#1ed760";
          ctx.arc(toX(debugInfo.indexTip.x), toY(debugInfo.indexTip.y), 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    paint();
  }, [visible, debugMode, debugInfo]);

  if (!visible) return null;

  const pct = Math.round((confidence || 0) * 100);

  return (
    <div className="gesture-overlay" aria-live="polite">
      <canvas ref={canvasRef} className="gesture-overlay-canvas" />

      {showBadge && (
        <div className="gesture-badge">
          <span className="gesture-badge-label">{gestureLabel}</span>
          <span className="gesture-badge-conf">{pct}%</span>
          {holdProgress > 0 && holdProgress < 1 && (
            <span className="gesture-hold-bar" title="Confirming restricted gesture">
              <span style={{ width: `${Math.round(holdProgress * 100)}%` }} />
            </span>
          )}
        </div>
      )}

      {debugMode && debugInfo && (
        <div className="gesture-debug-panel">
          <div>Hand detected: {debugInfo.handDetected ? "YES" : "NO"}</div>
          <div>Current gesture: {gestureLabel}</div>
          <div>Gesture confidence: {pct}%</div>
        </div>
      )}
    </div>
  );
}
