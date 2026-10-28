import React from "react";

function formatTime(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SummaryPanel({ summary }) {
  const rawBullets = Array.isArray(summary)
    ? summary
    : Array.isArray(summary?.bullets)
    ? summary.bullets
    : summary?.bullets
    ? [String(summary.bullets)]
    : [];

  const bullets = rawBullets
    .map((b) => (typeof b === "string" ? b.trim() : ""))
    .filter(Boolean);

  const updatedAt = summary?.updatedAt || (typeof summary === "object" ? summary?.ts : null);

  return (
    <div className="panel-section">
      <div className="panel-label">
        <span className="panel-label-text">Rolling Meeting Summary</span>
        {updatedAt && (
          <span className="summary-updated mono">updated {formatTime(updatedAt)}</span>
        )}
      </div>
      {bullets.length === 0 ? (
        <div className="empty-state">
          <span className="empty-orb" />
          Summary will bloom after the first pause.
        </div>
      ) : (
        <div className="summary-list">
          {bullets.map((b, i) => (
            <div key={i} className="summary-item">
              {b}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
