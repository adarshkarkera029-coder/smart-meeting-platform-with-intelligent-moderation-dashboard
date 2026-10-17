import React from "react";
import Waveform from "./Waveform.jsx";

export default function MicControls({
  micOn,
  onToggleMic,
  camOn,
  onToggleCam,
  listening,
  onToggleListening,
  handRaised = false,
  onToggleHand,
  screenSharing = false,
  onToggleScreenShare,
  onMuteAll,
  chatOpen = false,
  onToggleChat,
  unreadChat = 0,
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
          title={micOn ? "Mute microphone (M)" : "Unmute microphone (M)"}
          aria-label={micOn ? "Mute microphone" : "Unmute microphone"}
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
          className={`control-btn ${!camOn ? "muted-btn" : ""}`}
          onClick={onToggleCam}
          title={camOn ? "Stop video (V)" : "Start video (V)"}
          aria-label={camOn ? "Stop video" : "Start video"}
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

        {onToggleScreenShare && (
          <button
            className={`control-btn ${screenSharing ? "active-btn" : ""}`}
            onClick={onToggleScreenShare}
            title={screenSharing ? "Stop sharing screen" : "Share screen"}
            aria-label={screenSharing ? "Stop sharing screen" : "Share screen"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M12 13V7M9 10l3-3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {onToggleHand && (
          <button
            className={`control-btn ${handRaised ? "active-btn" : ""}`}
            onClick={onToggleHand}
            title={handRaised ? "Lower hand (H)" : "Raise hand (H)"}
            aria-label={handRaised ? "Lower hand" : "Raise hand"}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill={handRaised ? "currentColor" : "none"}>
              <path d="M7 11V6a1.5 1.5 0 013 0v5M10 5a1.5 1.5 0 013 0v6M13 6a1.5 1.5 0 013 0v5M16 8a1.5 1.5 0 013 0v5c0 4.418-3.582 8-8 8h-1c-3.866 0-7-3.134-7-7v-3a1.5 1.5 0 013 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}

        {onMuteAll && (
          <button
            className="control-btn"
            onClick={onMuteAll}
            title="Mute all participants"
            aria-label="Mute all participants"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
              <path d="M23 11l-6 6M17 11l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}

        {onToggleChat && (
          <button
            className={`control-btn ${chatOpen ? "active-btn" : ""}`}
            onClick={onToggleChat}
            title="Toggle chat (C)"
            aria-label="Toggle chat"
            style={{ position: "relative" }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {unreadChat > 0 && <span className="control-btn-badge">{unreadChat}</span>}
          </button>
        )}

        <button
          className={`control-btn control-btn-play ${listening ? "is-live" : "muted-btn"}`}
          onClick={onToggleListening}
          title={listening ? "Pause AI listening" : "Start AI listening"}
          aria-label={listening ? "Pause AI listening" : "Start AI listening"}
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
      </div>

      <div className="player-right">
        <button className="control-btn danger" onClick={onLeave} title="Leave meeting" aria-label="Leave meeting">
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
