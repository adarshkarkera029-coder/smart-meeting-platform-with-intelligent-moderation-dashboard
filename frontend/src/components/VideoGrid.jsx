import React, { useState } from "react";
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

  const handleTileClick = (pId) => {
    setFocusedId(pId);
    onLayoutModeChange?.("spotlight");
  };

  const handleUnfocus = () => {
    setFocusedId(null);
    onLayoutModeChange?.("grid");
  };

  // -------------------------------------------------------------
  // SPOTLIGHT / FOCUS MODE VIEW
  // -------------------------------------------------------------
  if (isSpotlight && focusedParticipant) {
    return (
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
    );
  }

  // -------------------------------------------------------------
  // FULL GRID MODE VIEW
  // -------------------------------------------------------------
  const gridCountClass =
    count <= 1 ? "1" : count === 2 ? "2" : count === 3 ? "3" : count === 4 ? "4" : count <= 6 ? "6" : "many";

  return (
    <div className={`video-layout video-layout-grid count-${gridCountClass}`}>
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
          onVideoRef={p.isLocal ? onLocalVideoRef : null}
          gestureOverlayProps={p.isLocal ? gestureOverlayProps : null}
        />
      ))}
    </div>
  );
}
