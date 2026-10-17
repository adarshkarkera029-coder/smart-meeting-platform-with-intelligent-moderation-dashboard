import React, { useEffect, useRef } from "react";
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
  /** Callback so parent can attach MediaPipe to the same <video> element */
  onVideoRef = null,
  gestureOverlayProps = null,
}) {
  const videoRef = useRef(null);

  const trackEnabled =
    !!stream &&
    stream.getVideoTracks().some((t) => t.enabled && t.readyState !== "ended");
  const hasVideo = isLocal ? camOn && trackEnabled : trackEnabled;

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
      const p = video.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    };

    tryPlay();
    video.addEventListener("loadedmetadata", tryPlay);

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
    };
  }, [stream]);

  // When camera is turned back on, resume the still-mounted <video>
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !hasVideo) return;

    if (video.srcObject !== stream) {
      video.srcObject = stream;
    }
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [hasVideo, stream, camOn]);

  const isSpotlight = variant === "spotlight";

  return (
    <div className={`video-tile ${variant} ${speaking ? "speaking" : ""} ${!hasVideo ? "no-video" : ""}`}>
      <span className="tile-halo" aria-hidden="true" />
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
