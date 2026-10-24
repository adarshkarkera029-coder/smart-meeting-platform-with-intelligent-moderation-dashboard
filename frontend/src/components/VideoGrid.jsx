import React, { useState, useEffect } from "react";
import VideoTile from "./VideoTile.jsx";

export default function VideoGrid({
  localName,
  localStream,
  localSpeaking,
  localLevel,
  micOn,
  camOn = true,
  localHandRaised = false,
  raisedHands = {},
  isAdmin = false,
  adminSocketId = null,
  onKickParticipant = null,
  participants,
  layoutMode = "grid",
  onLayoutModeChange = null,
  onLocalVideoRef = null,
  gestureOverlayProps = null,
}) {
  const [focusedId, setFocusedId] = useState(null);
  const [fullscreenId, setFullscreenId] = useState(null);
  const [fullscreenFit, setFullscreenFit] = useState("contain");
  const remoteEntries = Object.entries(participants);

  const allParticipants = [
    {
      id: "local",
      name: localName,
      stream: localStream,
      isLocal: true,
      speaking: localSpeaking,
      level: localLevel,
      micOn,
      camOn,
      handRaised: localHandRaised,
      isHost: isAdmin,
      canKick: false,
    },
    ...remoteEntries.map(([socketId, p]) => ({
      id: socketId,
      name: p.name,
      stream: p.stream,
      isLocal: false,
      speaking: p.speaking,
      level: p.speaking ? 0.6 : 0,
      micOn: true,
      camOn: p.camOn !== false,
      handRaised: !!raisedHands[socketId],
      isHost: socketId === adminSocketId || p.isAdmin,
      canKick: isAdmin,
    })),
  ];

  const count = allParticipants.length;

  // Active spotlight state
  const isSpotlight = layoutMode === "spotlight" || Boolean(focusedId);

  let focusedParticipant = null;
  if (isSpotlight) {
    if (focusedId) {
      focusedParticipant = allParticipants.find((p) => p.id === focusedId);
    }
    // Fallback: spotlight the first remote participant if available, else local
    if (!focusedParticipant) {
      focusedParticipant = allParticipants.find((p) => !p.isLocal) || allParticipants[0];
    }
  }

  // Keyboard Escape handler to exit fullscreen cleanly
  useEffect(() => {
    if (!fullscreenId) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        setFullscreenId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenId]);

  const handleTileClick = (pId) => {
    setFocusedId(pId);
    onLayoutModeChange?.("spotlight");
  };

  const handleUnfocus = () => {
    setFocusedId(null);
    onLayoutModeChange?.("grid");
  };

  // -------------------------------------------------------------
  // IMMERSIVE FULL SCREEN VIEW (Screen share / Large presentation)
  // -------------------------------------------------------------
  const fullscreenParticipant = fullscreenId
    ? allParticipants.find((p) => p.id === fullscreenId) || allParticipants[0]
    : null;

  return (
    <>
      {fullscreenParticipant && (
        <div className="video-fullscreen-overlay" role="dialog" aria-modal="true" aria-label="Full screen presentation">
          <div className="fullscreen-topbar">
            <div className="fullscreen-topbar-left">
              <button
                type="button"
                className="fullscreen-back-btn"
                onClick={() => setFullscreenId(null)}
                title="Go back to meeting view (Esc)"
                aria-label="Go back to meeting view"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <span>Back</span>
              </button>
              <div className="fullscreen-user-badge">
                <span className="fullscreen-live-pulse" />
                <span className="fullscreen-user-name">
                  {fullscreenParticipant.name}
                  {fullscreenParticipant.isLocal ? " (You)" : ""}
                </span>
                {fullscreenParticipant.isHost && <span className="tile-host-chip">Host</span>}
              </div>
            </div>

            <div className="fullscreen-topbar-right">
              <button
                type="button"
                className="fullscreen-fit-btn"
                onClick={() => setFullscreenFit((prev) => (prev === "contain" ? "cover" : "contain"))}
                title={fullscreenFit === "contain" ? "Fill entire screen (crop edges)" : "Fit to screen (preserve aspect ratio)"}
              >
                {fullscreenFit === "contain" ? (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="2" width="20" height="20" rx="3" />
                      <path d="M9 9h6v6H9z" />
                    </svg>
                    <span>Fill Screen</span>
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="5" width="20" height="14" rx="2" />
                      <path d="M8 2v3M16 2v3M8 19v3M16 19v3" />
                    </svg>
                    <span>Fit Screen</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className="fullscreen-close-btn"
                onClick={() => setFullscreenId(null)}
                title="Exit full screen (Esc)"
                aria-label="Exit full screen"
              >
                ✕
              </button>
            </div>
          </div>

          <div
            className="fullscreen-body"
            onDoubleClick={() => setFullscreenFit((prev) => (prev === "contain" ? "cover" : "contain"))}
            title="Double click to toggle fit / fill"
          >
            <VideoTile
              key={`fs-${fullscreenParticipant.id}`}
              name={fullscreenParticipant.name}
              stream={fullscreenParticipant.stream}
              isLocal={fullscreenParticipant.isLocal}
              speaking={fullscreenParticipant.speaking}
              level={fullscreenParticipant.level}
              micOn={fullscreenParticipant.micOn}
              camOn={fullscreenParticipant.camOn}
              handRaised={fullscreenParticipant.handRaised}
              isHost={fullscreenParticipant.isHost}
              canKick={fullscreenParticipant.canKick}
              onKick={() => onKickParticipant?.(fullscreenParticipant.id)}
              variant="spotlight"
              isFullscreen={true}
              fitMode={fullscreenFit}
              onVideoRef={fullscreenParticipant.isLocal ? onLocalVideoRef : null}
            />
          </div>

          {allParticipants.length > 1 && (
            <div className="fullscreen-bottom-strip">
              <div className="fullscreen-strip-scroller">
                {allParticipants.map((p) => {
                  const isSelected = p.id === fullscreenParticipant.id;
                  return (
                    <div
                      key={`fs-strip-${p.id}`}
                      className={`strip-item ${isSelected ? "active" : ""}`}
                      onClick={() => setFullscreenId(p.id)}
                      title={`Switch to ${p.name}`}
                    >
                      <VideoTile
                        name={p.name}
                        stream={p.stream}
                        isLocal={p.isLocal}
                        speaking={p.speaking}
                        level={p.level}
                        micOn={p.micOn}
                        camOn={p.camOn}
                        handRaised={p.handRaised}
                        isHost={p.isHost}
                        variant="tile"
                      />
                      {isSelected && <span className="strip-item-indicator">Viewing</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* SPOTLIGHT / FOCUS MODE VIEW */}
      {isSpotlight && focusedParticipant ? (
        <div className="video-layout video-layout-spotlight">
          <div className="spotlight-main">
            <VideoTile
              key={focusedParticipant.id}
              name={focusedParticipant.name}
              stream={focusedParticipant.stream}
              isLocal={focusedParticipant.isLocal}
              speaking={focusedParticipant.speaking}
              level={focusedParticipant.level}
              micOn={focusedParticipant.micOn}
              camOn={focusedParticipant.camOn}
              handRaised={focusedParticipant.handRaised}
              isHost={focusedParticipant.isHost}
              canKick={focusedParticipant.canKick}
              onKick={() => onKickParticipant?.(focusedParticipant.id)}
              variant="spotlight"
              isFocused={true}
              onUnfocus={handleUnfocus}
              onFullscreen={() => setFullscreenId(focusedParticipant.id)}
              onVideoRef={focusedParticipant.isLocal ? onLocalVideoRef : null}
              gestureOverlayProps={focusedParticipant.isLocal ? gestureOverlayProps : null}
            />
          </div>

          {allParticipants.length > 1 && (
            <div className="participants-strip" role="region" aria-label="Meeting participants">
              {allParticipants.map((p) => {
                const isSelected = p.id === focusedParticipant.id;
                return (
                  <div
                    key={p.id}
                    className={`strip-item ${isSelected ? "active" : ""}`}
                    onClick={() => setFocusedId(p.id)}
                    title={`Click to focus ${p.name}${p.isLocal ? " (You)" : ""}`}
                  >
                    <VideoTile
                      name={p.name}
                      stream={p.stream}
                      isLocal={p.isLocal}
                      speaking={p.speaking}
                      level={p.level}
                      micOn={p.micOn}
                      camOn={p.camOn}
                      handRaised={p.handRaised}
                      isHost={p.isHost}
                      variant="tile"
                      onFullscreen={() => setFullscreenId(p.id)}
                      onVideoRef={p.isLocal && isSelected ? null : (p.isLocal ? onLocalVideoRef : null)}
                    />
                    {isSelected && (
                      <span className="strip-item-indicator">Viewing</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* FULL GRID MODE VIEW */
        <div className={`video-layout video-layout-grid count-${count <= 1 ? "1" : count === 2 ? "2" : count === 3 ? "3" : count === 4 ? "4" : count <= 6 ? "6" : "many"}`}>
          {allParticipants.map((p) => (
            <VideoTile
              key={p.id}
              name={p.name}
              stream={p.stream}
              isLocal={p.isLocal}
              speaking={p.speaking}
              level={p.level}
              micOn={p.micOn}
              camOn={p.camOn}
              handRaised={p.handRaised}
              isHost={p.isHost}
              canKick={p.canKick}
              onKick={() => onKickParticipant?.(p.id)}
              variant="tile"
              onClick={() => handleTileClick(p.id)}
              onFullscreen={() => setFullscreenId(p.id)}
              onVideoRef={p.isLocal ? onLocalVideoRef : null}
              gestureOverlayProps={p.isLocal ? gestureOverlayProps : null}
            />
          ))}
        </div>
      )}
    </>
  );
}
