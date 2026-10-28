import React, { useEffect, useRef, useState } from "react";
import { apiUrl } from "../lib/backendUrl.js";

export default function MailModal({ roomId, summary, sentBy, defaultEmail = "", onClose }) {
  const overlayRef = useRef(null);
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");
  const [emailReady, setEmailReady] = useState(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(apiUrl("/api/email/status"))
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setEmailReady(!!data.configured);
      })
      .catch(() => {
        if (!cancelled) setEmailReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError("");
    try {
      const res = await fetch(apiUrl(`/api/rooms/${encodeURIComponent(roomId)}/email-summary`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: email.trim(), sentBy }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to send email");
      }
      setStatus("sent");
      setTimeout(() => onClose(), 2200);
    } catch (err) {
      setStatus("error");
      setError(err.message || "Failed to send email");
    }
  };

  const bullets = Array.isArray(summary)
    ? summary
    : Array.isArray(summary?.bullets)
    ? summary.bullets
    : summary?.bullets
    ? [String(summary.bullets)]
    : [];
  const bulletCount = bullets.filter((b) => typeof b === "string" && b.trim().length > 0).length;

  return (
    <div className="invite-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="invite-modal mail-modal" data-fluid-ignore>
        <div className="invite-modal-header">
          <div className="invite-modal-title-row">
            <div className="invite-modal-icon">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
                <path d="M22 7l-10 7L2 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <h2 className="invite-modal-title">Email Summary</h2>
              <p className="invite-modal-subtitle">
                {bulletCount > 0
                  ? `${bulletCount} takeaway${bulletCount === 1 ? "" : "s"} ready to send`
                  : "Send meeting notes & transcript"}
              </p>
            </div>
          </div>
          <button className="invite-close-btn" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="invite-section">
          {status === "sent" ? (
            <div className="mail-success">
              <svg viewBox="0 0 24 24" fill="none" className="mail-success-icon">
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <h3>Summary sent</h3>
              <p>Check <strong>{email}</strong> — including spam if it doesn’t appear right away.</p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="mail-form">
              {emailReady === false && (
                <div className="mail-config-hint">
                  Email delivery isn’t configured yet. Add <code>RESEND_API_KEY</code> or SMTP settings in{" "}
                  <code>backend/.env</code>, then restart the backend.
                </div>
              )}

              <div>
                <label className="field-label" htmlFor="mail-to">Recipient email</label>
                <input
                  id="mail-to"
                  type="email"
                  className="field-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === "sending"}
                  autoFocus
                />
              </div>

              {status === "error" && error && (
                <div className="auth-feedback error">{error}</div>
              )}

              <div className="mail-actions">
                <button
                  type="button"
                  className="invite-native-share-btn"
                  onClick={onClose}
                  disabled={status === "sending"}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="join-btn mail-send-btn"
                  disabled={status === "sending" || !email.trim()}
                >
                  {status === "sending" ? (
                    <span className="btn-spinner-row">
                      <span className="btn-spinner" />
                      Sending…
                    </span>
                  ) : (
                    "Send Summary"
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
