import React from "react";
import Waveform from "./Waveform.jsx";

export default function MicControls({
  micOn,
  onToggleMic,
  camOn,
  onToggleCam,
  listening,
  onToggleListening,
  onLeave,
  name = "You",
  level = 0,
  isSpeaking = false,
  connected = true,
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "Y";

  return (
    <div className="player-bar">
      <div className="player-now">
        <div className={`player-art ${isSpeaking ? "is-speaking" : ""}`}>{initials}</div>
        <div className="player-now-copy">
          <div className="player-title">{name}</div>
          <div className="player-sub">
            {listening ? (isSpeaking ? "You’re on air" : "AI listening") : "AI paused"}
            {connected ? "" : " · reconnecting"}
          </div>
        </div>
        <Waveform level={level} active={isSpeaking && listening} />
      </div>

      <div className="player-center glass-dock">
        <button
          className={`control-btn ${!micOn ? "muted-btn" : ""}`}
          onClick={onToggleMic}
          title={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.8" />
              <path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 15a3 3 0 003-3V6a3 3 0 00-5.9-.8M9 9v3a3 3 0 004.24 2.74" stroke="currentColor" strokeWidth="1.8" />
              <path d="M19 11a7 7 0 01-9.8 6.4M5 11a7 7 0 001.5 4.3M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <button
          className={`control-btn control-btn-play ${listening ? "is-live" : "muted-btn"}`}
          onClick={onToggleListening}
          title={listening ? "Pause AI listening" : "Start AI listening"}
        >
          {listening ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="1" />
              <rect x="14" y="5" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5.5v13l11-6.5-11-6.5z" />
            </svg>
          )}
        </button>

        <button
          className={`control-btn ${!camOn ? "muted-btn" : ""}`}
          onClick={onToggleCam}
          title={camOn ? "Stop video" : "Start video"}
        >
          {camOn ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M15 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <rect x="2" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M15 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      </div>

      <div className="player-right">
        <button className="control-btn danger" onClick={onLeave} title="Leave meeting">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M3.68 16.07l1.92-1.92a1.5 1.5 0 011.5-.37l2.13.66a1.5 1.5 0 001.1-.13l2.24-1.24a1.5 1.5 0 011.46 0l2.24 1.24a1.5 1.5 0 001.1.13l2.13-.66a1.5 1.5 0 011.5.37l1.92 1.92a1 1 0 01-.13 1.47A16.38 16.38 0 0112 20a16.38 16.38 0 01-8.19-2.46 1 1 0 01-.13-1.47z"
              stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"
            />
            <path d="M12 4v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
