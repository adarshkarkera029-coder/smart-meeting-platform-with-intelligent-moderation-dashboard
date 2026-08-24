import React from "react";
import VideoTile from "./VideoTile.jsx";

export default function VideoGrid({
  localName,
  localStream,
  localSpeaking,
  localLevel,
  micOn,
  camOn = true,
  participants,
  layoutMode = "grid",
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
            variant="spotlight"
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
          variant="spotlight"
        />
      ))}
    </div>
  );
}
