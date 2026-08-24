import React, { useEffect, useRef } from "react";

export default function CalendarModal({ onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const meetings = [
    { time: "09:00", title: "Daily Standup", attendees: "Team Alpha", tone: "teal" },
    { time: "11:30", title: "Design Sync", attendees: "UI/UX Dept", tone: "violet" },
    { time: "14:00", title: "Q3 Planning", attendees: "Leadership", tone: "rose" },
    { time: "16:15", title: "1:1 with Alex", attendees: "Alex", tone: "amber" },
  ];

  return (
    <div className="invite-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="invite-modal calendar-modal" data-fluid-ignore>
        <div className="invite-modal-header">
          <div className="invite-modal-title-row">
            <div className="invite-modal-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="invite-modal-title">Today</h2>
              <p className="invite-modal-subtitle">A quiet timeline of what’s next</p>
            </div>
          </div>
          <button className="invite-close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="calendar-list">
          {meetings.map((meeting) => (
            <div key={meeting.title} className={`calendar-row tone-${meeting.tone}`}>
              <div className="calendar-time">{meeting.time}</div>
              <div className="calendar-copy">
                <div className="calendar-title">{meeting.title}</div>
                <div className="calendar-meta">{meeting.attendees}</div>
              </div>
              <button type="button" className="ghost-chip-btn">Join</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
