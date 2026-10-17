import React from "react";
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
  onLocalVideoRef = null,
  gestureOverlayProps = null,
}) {
  const remoteEntries = Object.entries(participants);

  // -- GRID MODE LOGIC --
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
      camOn: true,
      handRaised: !!raisedHands[socketId],
      isHost: socketId === adminSocketId || p.isAdmin,
      canKick: isAdmin,
    })),
  ];

  const count = allParticipants.length;
  let gridTemplateColumns = "1fr";
  if (count === 2) {
    gridTemplateColumns = "1fr 1fr";
  } else if (count > 2) {
    gridTemplateColumns = "repeat(auto-fit, minmax(300px, 1fr))";
  }

  // -- SPOTLIGHT MODE LOGIC --
  const visibleRemotes = remoteEntries.slice(0, 3);
  const moreCount = remoteEntries.length - visibleRemotes.length;

  if (layoutMode === "spotlight") {
    return (
      <div className="video-layout" style={{ display: "flex", flexDirection: "column" }}>
        <div className="spotlight-wrapper">
          <VideoTile
            name={localName}
            stream={localStream}
            isLocal
            speaking={localSpeaking}
            level={localLevel}
            micOn={micOn}
            camOn={camOn}
            handRaised={localHandRaised}
            isHost={isAdmin}
            variant="spotlight"
            onVideoRef={onLocalVideoRef}
            gestureOverlayProps={gestureOverlayProps}
          />
        </div>

        {remoteEntries.length > 0 && (
          <div className="participants-row">
            {visibleRemotes.map(([socketId, p]) => (
              <VideoTile
                key={socketId}
                name={p.name}
                stream={p.stream}
                speaking={p.speaking}
                level={p.speaking ? 0.6 : 0}
                micOn={true}
                camOn={true}
                handRaised={!!raisedHands[socketId]}
                isHost={socketId === adminSocketId || p.isAdmin}
                canKick={isAdmin}
                onKick={() => onKickParticipant?.(socketId)}
                variant="tile"
              />
            ))}
            {moreCount > 0 && (
              <div className="participant-more">
                <span className="more-dots">••</span>
                <span className="more-count">+ {moreCount} more</span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="video-layout"
      style={{
        display: "grid",
        gridTemplateColumns,
        gap: "12px",
        flex: 1,
        minHeight: 0,
      }}
    >
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
          variant="spotlight"
          onVideoRef={p.isLocal ? onLocalVideoRef : null}
          gestureOverlayProps={p.isLocal ? gestureOverlayProps : null}
        />
      ))}
    </div>
  );
}
