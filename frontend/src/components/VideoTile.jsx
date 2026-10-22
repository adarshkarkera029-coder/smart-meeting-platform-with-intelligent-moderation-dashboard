import React, { useEffect, useRef, useState } from "react";
import Waveform from "./Waveform.jsx";
import GestureOverlay from "./GestureOverlay.jsx";

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

export default function VideoTile({
  name,
  stream,
  muted = false,
  speaking = false,
  level = 0,
  isLocal = false,
  micOn = true,
  camOn = true,
  handRaised = false,
  isHost = false,
  canKick = false,
  onKick = null,
  variant = "tile",
  isFocused = false,
  onUnfocus = null,
  onClick = null,
  /** Callback so parent can attach MediaPipe to the same <video> element */
  onVideoRef = null,
  gestureOverlayProps = null,
}) {
  const videoRef = useRef(null);
  const [hasStreamVideo, setHasStreamVideo] = useState(() => {
    if (!stream) return false;
    return stream.getVideoTracks().some((t) => t.readyState !== "ended");
  });

  // Track stream additions and video track status reactively
  useEffect(() => {
    if (!stream) {
      setHasStreamVideo(false);
      return;
    }

    const updateTrackStatus = () => {
      const vTracks = stream.getVideoTracks();
      const hasLive = vTracks.some((t) => t.readyState !== "ended");
      setHasStreamVideo(hasLive);
    };

    updateTrackStatus();

    stream.addEventListener("addtrack", updateTrackStatus);
    stream.addEventListener("removetrack", updateTrackStatus);

    const tracks = stream.getVideoTracks();
    tracks.forEach((t) => {
      t.addEventListener("mute", updateTrackStatus);
      t.addEventListener("unmute", updateTrackStatus);
      t.addEventListener("ended", updateTrackStatus);
    });

    return () => {
      stream.removeEventListener("addtrack", updateTrackStatus);
      stream.removeEventListener("removetrack", updateTrackStatus);
      tracks.forEach((t) => {
        t.removeEventListener("mute", updateTrackStatus);
        t.removeEventListener("unmute", updateTrackStatus);
        t.removeEventListener("ended", updateTrackStatus);
      });
    };
  }, [stream]);

  const localTrackLive =
    !!stream &&
    stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");
  const hasVideo = isLocal ? camOn && localTrackLive : camOn && hasStreamVideo;

  useEffect(() => {
    if (!isLocal || !onVideoRef) return;
    onVideoRef(videoRef.current);
    return () => onVideoRef(null);
  }, [isLocal, onVideoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }

    const tryPlay = () => {
      if (video.paused) {
        const p = video.play();
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    };

    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, [stream, hasVideo]);

  const isSpotlight = variant === "spotlight";

  return (
    <div
      className={`video-tile ${variant} ${speaking ? "speaking" : ""} ${!hasVideo ? "no-video" : ""} ${isFocused ? "is-focused" : ""} ${onClick ? "clickable" : ""}`}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
    >
      <span className="tile-halo" aria-hidden="true" />

      {isFocused && (
        <div className="tile-focus-bar">
          <span className="tile-focus-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
            Focused
          </span>
          {onUnfocus && (
            <button
              type="button"
              className="tile-unfocus-btn"
              onClick={(e) => {
                e.stopPropagation();
                onUnfocus();
              }}
              title="Return to grid view"
              aria-label="Return to grid view"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                <rect x="14" y="3" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                <rect x="14" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
                <rect x="3" y="14" width="7" height="7" stroke="currentColor" strokeWidth="2" rx="1"/>
              </svg>
              <span>Grid</span>
            </button>
          )}
        </div>
      )}
      {/* Keep <video> mounted so cam off/on does not lose the stream binding */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted || isLocal}
        className={isLocal ? "is-local-preview" : undefined}
        style={{ display: hasVideo ? "block" : "none" }}
      />
      {!hasVideo && (
        <div className="avatar-fallback">
          <span>{initials(name)}</span>
        </div>
      )}

      {isLocal && gestureOverlayProps && hasVideo && (
        <GestureOverlay {...gestureOverlayProps} />
      )}

      {handRaised && (
        <span className="tile-hand-chip" title={`${name} raised hand`}>
          ✋ Hand raised
        </span>
      )}

      <div className={isSpotlight ? "tile-name-overlay" : "tile-footer"}>
        <span className="tile-name-chip">
          <span className="tile-name">{name}{isLocal ? " (You)" : ""}</span>
          {isHost && <span className="tile-host-chip">Host</span>}
        </span>
        <div className="tile-footer-right">
          {speaking && <Waveform level={level} active={speaking} />}
          {!micOn && (
            <span className="tile-mic-icon muted">
              <MicOffIcon />
            </span>
          )}
          {!isLocal && canKick && onKick && (
            <button
              type="button"
              className="tile-kick-btn"
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm(`Remove ${name} from this meeting?`)) {
                  onKick();
                }
              }}
              title={`Remove ${name} from meeting`}
              aria-label={`Remove ${name}`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M17 11l6 6M23 11l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function MicOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path
        d="M12 15a3 3 0 003-3V6a3 3 0 00-5.9-.8M9 9v3a3 3 0 004.24 2.74"
        stroke="currentColor" strokeWidth="1.8"
      />
      <path d="M19 11a7 7 0 01-9.8 6.4M5 11a7 7 0 001.5 4.3M12 18v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
