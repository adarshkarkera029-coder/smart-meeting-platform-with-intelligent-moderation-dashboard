import React from "react";

// Deterministic color per speaker name so the same person always gets the
// same swatch color across the meeting.
const SWATCH_COLORS = ["#35e0b5", "#f2a93c", "#7aa2f7", "#e0779b", "#9ece6a", "#bb9af7"];

function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % SWATCH_COLORS.length;
  return SWATCH_COLORS[Math.abs(hash) % SWATCH_COLORS.length];
}

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

function timeAgo(ts) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (diff < 10) return "Live";
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ago`;
}

// ── Speaker card — redesigned to match reference mockup ──────────────
export default function SpeakerCard({ name, points, streamingEntries = [] }) {
  const color = colorForName(name);
  const isStreaming = streamingEntries.length > 0;

  // Get timestamp from latest point
  const latestTs = points[0]?.timestamp || points[0]?.ts || null;

  return (
    <div
      className={`speaker-card ${isStreaming ? "speaking" : ""}`}
      style={{ borderLeftColor: color }}
    >
      <div className="speaker-card-header">
        <div className="speaker-avatar" style={{ background: color }}>
          {initials(name)}
        </div>
        <div>
          <span className="speaker-name">{name}</span>{" "}
          <span className="speaker-role">(Participant)</span>
        </div>
        <div className="speaker-meta">
          {isStreaming && (
            <span className="speaking-badge">
              <span className="speaking-badge-dot" />
              Speaking
            </span>
          )}
          <span className="speaker-time">
            {isStreaming ? "Live" : (timeAgo(latestTs) || "")}
          </span>
        </div>
      </div>

      <div className="speaker-points-list">
        {/* All finalized points (oldest first → newest at bottom) */}
        {[...points].reverse().map((pt, i) => (
          <div key={pt.pointId || i} className="speaker-point-row">
            {pt.text}
          </div>
        ))}

        {/* Currently streaming text (appears at the very bottom) */}
        {streamingEntries.map((entry) => (
          <div key={entry.pointId} className="speaker-point-row is-streaming">
            <span className="typewriter-text">{entry.text}</span>
            <span className="typewriter-cursor" aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

