import React from "react";
import SpeakerCard from "./SpeakerCard.jsx";

export default function SpeakerDashboard({ speakerPoints, streamingPoints = {} }) {
  const speakers = Object.entries(speakerPoints || {});

  // Collect all in-flight streaming entries, grouped by speaker
  // so we can prepend them above the finalised points
  const streamingBySpeaker = {};
  for (const [pointId, { speaker, text }] of Object.entries(streamingPoints)) {
    if (!streamingBySpeaker[speaker]) streamingBySpeaker[speaker] = [];
    streamingBySpeaker[speaker].push({ pointId, text });
  }

  // Merge: any speaker that only has a streaming entry (not yet in speakerPoints)
  const allSpeakers = new Set([
    ...speakers.map(([n]) => n),
    ...Object.keys(streamingBySpeaker),
  ]);

  // Sort: streaming (actively speaking) speakers appear first
  const sorted = [...allSpeakers].sort((a, b) => {
    const aStreaming = !!streamingBySpeaker[a];
    const bStreaming = !!streamingBySpeaker[b];
    if (aStreaming && !bStreaming) return -1;
    if (!aStreaming && bStreaming) return 1;
    return 0;
  });

  if (sorted.length === 0) {
    return (
      <div className="empty-state">
        <svg className="empty-state-icon" width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M12 15a3 3 0 003-3V6a3 3 0 10-6 0v6a3 3 0 003 3z" stroke="currentColor" strokeWidth="1.5" />
          <path d="M19 11a7 7 0 01-14 0M12 18v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Waiting for the first voice…
        <div className="empty-state-hint">
          Keep the mic unmuted and AI listening on. Speak a full sentence, then pause — notes appear here.
        </div>
      </div>
    );
  }

  return (
    <>
      {sorted.map((name) => (
        <SpeakerCard
          key={name}
          name={name}
          points={speakerPoints[name] || []}
          streamingEntries={streamingBySpeaker[name] || []}
        />
      ))}
    </>
  );
}
