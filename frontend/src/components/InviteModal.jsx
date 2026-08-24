import React, { useState, useEffect, useRef } from "react";

export default function InviteModal({ roomId, onClose }) {
  const [linkCopied, setLinkCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const overlayRef = useRef(null);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;

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

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = inviteUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    }
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = roomId;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2500);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Join my meeting: ${roomId}`,
          text: `Join my Meet // Console meeting!\n\nRoom code: ${roomId}`,
          url: inviteUrl,
        });
      } catch {
        // user cancelled or not supported
      }
    }
  };

  return (
    <div className="invite-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="invite-modal" data-fluid-ignore>
        {/* Header */}
        <div className="invite-modal-header">
          <div className="invite-modal-title-row">
            <div className="invite-modal-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
                <path d="M19 8v6M22 11h-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h2 className="invite-modal-title">Invite People</h2>
              <p className="invite-modal-subtitle">Share link or room code to let others join</p>
            </div>
          </div>
          <button className="invite-close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Share via Link */}
        <div className="invite-section">
          <div className="invite-section-label">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Share via Link
          </div>
          <div className="invite-link-row">
            <div className="invite-link-display">
              <span className="invite-link-text">{inviteUrl}</span>
            </div>
            <button
              className={`invite-copy-btn ${linkCopied ? "copied" : ""}`}
              onClick={copyLink}
            >
              {linkCopied ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none">
                    <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none">
                    <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8" />
                  </svg>
                  Copy Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="invite-divider">
          <span className="invite-divider-line" />
          <span className="invite-divider-text">or</span>
          <span className="invite-divider-line" />
        </div>

        {/* Share via Room Code */}
        <div className="invite-section">
          <div className="invite-section-label">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            Room Code
          </div>
          <p className="invite-code-hint">
            Others can join by entering this code on the join screen
          </p>
          <div className="invite-code-display">
            <span className="invite-code-value">{roomId}</span>
            <button
              className={`invite-code-copy-btn ${codeCopied ? "copied" : ""}`}
              onClick={copyCode}
            >
              {codeCopied ? (
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Native Share (if available) */}
        {typeof navigator !== "undefined" && navigator.share && (
          <button className="invite-native-share-btn" onClick={shareNative}>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="18" cy="5" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="6" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <circle cx="18" cy="19" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            Share via other apps
          </button>
        )}
      </div>
    </div>
  );
}
