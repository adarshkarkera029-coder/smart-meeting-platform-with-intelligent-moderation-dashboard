import React from "react";

export default function ModerationDashboard({ alerts }) {
  const list = alerts || [];

  return (
    <div className="panel-section">
      <div className="panel-label">
        <span className="panel-label-text">Moderation Alerts</span>
      </div>
      {list.length === 0 ? (
        <div className="empty-state">Waiting for speech…</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[...list].reverse().map((a) => (
            <div key={a.id} className={`mod-alert ${a.severity}`}>
              <span className={`mod-severity ${a.severity}`}>{a.severity}</span>
              <div className="mod-body">
                <span className="mod-speaker">{a.speaker}</span>
                <span className="mod-reason">{a.reason}</span>
                <span className="mod-text">"{a.text}"</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
