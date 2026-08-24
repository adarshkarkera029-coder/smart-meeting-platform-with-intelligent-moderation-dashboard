import React from "react";

function formatTime(ts) {
  if (!ts) return null;
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SummaryPanel({ summary }) {
  const bullets = summary?.bullets || [];

  return (
    <div className="panel-section">
      <div className="panel-label">
        <span className="panel-label-text">Rolling Meeting Summary</span>
        {summary?.updatedAt && (
          <span className="summary-updated mono">updated {formatTime(summary.updatedAt)}</span>
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
