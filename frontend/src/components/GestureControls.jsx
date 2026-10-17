import React from "react";

/**
 * Compact AI Gesture Detection panel — matches meeting UI chrome.
 */
export default function GestureControls({
  open,
  onToggleOpen,
  gestureEnabled,
  onToggleGesture,
  safetyEnabled,
  onToggleSafety,
  debugMode,
  onToggleDebug,
  gestureLabel,
  confidence,
  status,
  statusMessage,
  safetyNotice,
  onReenableCamera,
  onDismissNotice,
  isAdmin = false,
}) {
  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onToggleOpen();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onToggleOpen]);

  const pct = Math.round((confidence || 0) * 100);

  return (
    <div className={`gesture-panel ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className={`gesture-panel-toggle ${gestureEnabled ? "is-active" : ""}`}
        onClick={onToggleOpen}
        title="AI Gesture Detection"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M8 13V7a2 2 0 114 0v6M12 11V5a2 2 0 114 0v8M16 12V8a2 2 0 114 0v7a6 6 0 01-6 6H11a6 6 0 01-5.2-3L4 14.5a2 2 0 112.8-2.8L8 13"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span>Gestures</span>
      </button>

      {open && (
        <div className="gesture-panel-body">
          <div className="gesture-panel-title">
            <span>AI Gesture Detection</span>
            {isAdmin && <span className="host-badge-chip">Admin</span>}
          </div>

          {isAdmin ? (
            <label className="gesture-switch">
              <input
                type="checkbox"
                checked={gestureEnabled}
                onChange={(e) => onToggleGesture(e.target.checked)}
              />
              <span>Room Gesture Detection</span>
            </label>
          ) : (
            <div className="gesture-managed-notice">
              <span
                className="gesture-managed-indicator"
                style={{ background: gestureEnabled ? "#7cffd4" : "#fb7185" }}
              />
              <span>Detection {gestureEnabled ? "Active" : "Disabled"} (Managed by Host)</span>
            </div>
          )}

          {isAdmin && (
            <label className={`gesture-switch ${!gestureEnabled ? "is-disabled" : ""}`}>
              <input
                type="checkbox"
                checked={safetyEnabled}
                disabled={!gestureEnabled}
                onChange={(e) => onToggleSafety(e.target.checked)}
              />
              <span>Safety Auto-Cut</span>
            </label>
          )}

          <label className={`gesture-switch ${!gestureEnabled ? "is-disabled" : ""}`}>
            <input
              type="checkbox"
              checked={debugMode}
              disabled={!gestureEnabled}
              onChange={(e) => onToggleDebug(e.target.checked)}
            />
            <span>Debug Mode</span>
          </label>

          <div className="gesture-status-row">
            <span className="gesture-status-key">Current</span>
            <span className="gesture-status-val">
              {gestureEnabled ? gestureLabel : "Off"}
            </span>
          </div>
          <div className="gesture-status-row">
            <span className="gesture-status-key">Confidence</span>
            <span className="gesture-status-val">
              {gestureEnabled ? `${pct}%` : "—"}
            </span>
          </div>

          {status === "waiting" && (
            <div className="gesture-hint">Starts after your camera is on.</div>
          )}
          {status === "loading" && (
            <div className="gesture-hint">Loading hand model…</div>
          )}
          {status === "unavailable" && statusMessage && (
            <div className="gesture-hint is-warn">{statusMessage}</div>
          )}
          {gestureEnabled && safetyEnabled && (
            <div className="gesture-hint">
              Restricted gestures turn the camera off immediately.
            </div>
          )}
        </div>
      )}

      {safetyNotice && (
        <div className="gesture-safety-toast" role="alert">
          <div className="gesture-safety-toast-text">{safetyNotice.message}</div>
          <div className="gesture-safety-toast-actions">
            <button type="button" className="gesture-toast-btn" onClick={onReenableCamera}>
              Turn camera on
            </button>
            <button
              type="button"
              className="gesture-toast-btn ghost"
              onClick={onDismissNotice}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
