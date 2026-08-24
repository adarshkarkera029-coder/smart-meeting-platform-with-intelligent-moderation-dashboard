import React, { useState } from "react";
import { useAuth } from "../lib/AuthContext.jsx";
import { useTheme } from "../lib/ThemeContext.jsx";
import BrandMark from "./BrandMark.jsx";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
      <path d="M21 14.5A8.5 8.5 0 1110.5 3 7 7 0 0021 14.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-1.5 3.5-5.1 3.5-3.1 0-5.6-2.5-5.6-5.6S8.9 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 6.9 2.7 2.7 6.9 2.7 12S6.9 21.3 12 21.3c5.2 0 8.6-3.6 8.6-8.7 0-.6-.1-1-.2-1.4H12z" />
      <path fill="#34A853" d="M3.9 7.4l3 2.2C7.7 7.3 9.7 6.1 12 6.1c1.8 0 3 .7 3.7 1.4l2.5-2.4C16.7 3.7 14.5 2.7 12 2.7 8.3 2.7 5.1 4.8 3.9 7.4z" />
      <path fill="#4A90E2" d="M12 21.3c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.6-1.9 1-3.1 1-2.4 0-4.4-1.6-5.1-3.8l-3 2.3c1.4 2.8 4.2 4.9 8.1 4.9z" />
      <path fill="#FBBC05" d="M6.9 14.1c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9l-3-2.3C3.3 9.3 3 10.6 3 12s.3 2.7.9 3.9l3-1.8z" />
    </svg>
  );
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.48 2 2 6.58 2 12.26c0 4.52 2.87 8.35 6.84 9.7.5.1.68-.22.68-.48 0-.24-.01-.87-.01-1.7-2.78.62-3.37-1.37-3.37-1.37-.45-1.18-1.11-1.5-1.11-1.5-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.89 1.56 2.34 1.11 2.91.85.09-.66.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.31.1-2.73 0 0 .84-.27 2.75 1.05A9.3 9.3 0 0112 6.8c.85 0 1.71.12 2.51.34 1.91-1.32 2.75-1.05 2.75-1.05.55 1.42.2 2.47.1 2.73.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.95.68 1.92 0 1.38-.01 2.49-.01 2.83 0 .26.18.59.69.48A10.27 10.27 0 0022 12.26C22 6.58 17.52 2 12 2z" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path fill="#F25022" d="M3 3h8.5v8.5H3z" />
      <path fill="#7FBA00" d="M12.5 3H21v8.5h-8.5z" />
      <path fill="#00A4EF" d="M3 12.5h8.5V21H3z" />
      <path fill="#FFB900" d="M12.5 12.5H21V21h-8.5z" />
    </svg>
  );
}

export default function AuthScreen({ onAuthenticated }) {
  const {
    isFirebaseConfigured,
    continueAsGuest,
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    signInWithGithub,
    signInWithMicrosoft,
    sendPhoneOtp,
    confirmPhoneOtp,
    authError,
    setAuthError,
  } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mode, setMode] = useState("email"); // email | social | phone | guest
  const [emailMode, setEmailMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneName, setPhoneName] = useState("");
  const [confirmation, setConfirmation] = useState(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState("");

  const run = async (fn) => {
    setBusy(true);
    setAuthError(null);
    setInfo("");
    try {
      await fn();
      onAuthenticated?.();
    } catch (err) {
      setAuthError(err.message || "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGuest = (e) => {
    e.preventDefault();
    run(async () => continueAsGuest(guestName));
  };

  const handleEmail = (e) => {
    e.preventDefault();
    run(async () => {
      if (emailMode === "signup") {
        await signUpWithEmail(email, password, displayName);
      } else {
        await signInWithEmail(email, password);
      }
    });
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    setAuthError(null);
    setInfo("");
    try {
      const normalized = phone.trim().startsWith("+") ? phone.trim() : `+${phone.trim()}`;
      const conf = await sendPhoneOtp(normalized);
      setConfirmation(conf);
      setInfo("OTP sent. Enter the code from your SMS.");
    } catch (err) {
      setAuthError(err.message || "Failed to send OTP");
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!confirmation) return;
    run(async () => confirmPhoneOtp(confirmation, otp.trim(), phoneName));
  };

  return (
    <div className="auth-screen lumen-screen">
      <div className="theme-fab-group" role="group" aria-label="Theme">
        <button
          type="button"
          className={`theme-fab theme-fab-light ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
          title="Light mode"
          aria-pressed={theme === "light"}
        >
          <SunIcon />
        </button>
        <button
          type="button"
          className={`theme-fab theme-fab-dark ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
          title="Dark mode"
          aria-pressed={theme === "dark"}
        >
          <MoonIcon />
        </button>
      </div>
      <div className="lumen-shell">
        <section className="lumen-visual">
          <div className="brand brand-hero">
            <BrandMark size={36} />
            <span className="brand-name">Meet</span>
          </div>
          <p className="lumen-kicker">Live video · Live AI</p>
          <h1 className="lumen-display">Meet in a new light.</h1>
          <p className="lumen-lead">
            Calls that listen with you — speaker notes, rolling summaries, and a room that feels like a studio.
          </p>
          <div className="lumen-bento">
            <article className="bento-card bento-wide">
              <span className="bento-icon">✦</span>
              <strong>AI that writes as you speak</strong>
              <p>Notes appear per speaker, live, with a rolling summary you can email after.</p>
            </article>
            <article className="bento-card">
              <span className="bento-icon">◎</span>
              <strong>Instant rooms</strong>
              <p>Share a code or a link. That’s it.</p>
            </article>
            <article className="bento-card">
              <span className="bento-icon">◌</span>
              <strong>Private by default</strong>
              <p>Peer video. No cloud recorder.</p>
            </article>
          </div>
        </section>
        <div className="auth-card lumen-panel" data-fluid-ignore>
        <div className="brand">
          <BrandMark size={28} />
          <span className="brand-name">Meet</span>
        </div>

        <h1 className="join-title">Sign in to continue</h1>
        <p className="join-sub">
          Email, Google, phone, or a guest name — then drop into a room.
        </p>

        {isFirebaseConfigured ? (
          <>
            <div className="auth-tabs auth-tabs-4">
              <button
                type="button"
                className={`auth-tab ${mode === "email" ? "active" : ""}`}
                onClick={() => setMode("email")}
              >
                Email
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === "social" ? "active" : ""}`}
                onClick={() => setMode("social")}
              >
                Social
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === "phone" ? "active" : ""}`}
                onClick={() => setMode("phone")}
              >
                Phone
              </button>
              <button
                type="button"
                className={`auth-tab ${mode === "guest" ? "active" : ""}`}
                onClick={() => setMode("guest")}
              >
                Guest
              </button>
            </div>

            {mode === "email" && (
              <form className="auth-form" onSubmit={handleEmail}>
                <div className="auth-email-toggle">
                  <button
                    type="button"
                    className={`auth-link-btn ${emailMode === "signin" ? "active-toggle" : ""}`}
                    onClick={() => setEmailMode("signin")}
                  >
                    Sign in
                  </button>
                  <span className="auth-toggle-sep">·</span>
                  <button
                    type="button"
                    className={`auth-link-btn ${emailMode === "signup" ? "active-toggle" : ""}`}
                    onClick={() => setEmailMode("signup")}
                  >
                    Create account
                  </button>
                </div>

                {emailMode === "signup" && (
                  <>
                    <label className="field-label" htmlFor="display-name">Display name</label>
                    <input
                      id="display-name"
                      className="field-input"
                      placeholder="e.g. Priya"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      disabled={busy}
                    />
                  </>
                )}

                <label className="field-label" htmlFor="email-input">Email</label>
                <input
                  id="email-input"
                  type="email"
                  className="field-input"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={busy}
                  autoComplete="email"
                  required
                />

                <label className="field-label" htmlFor="password-input">Password</label>
                <input
                  id="password-input"
                  type="password"
                  className="field-input"
                  placeholder={emailMode === "signup" ? "At least 6 characters" : "Your password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={busy}
                  autoComplete={emailMode === "signup" ? "new-password" : "current-password"}
                  minLength={6}
                  required
                />

                <button
                  className="join-btn lumen-cta"
                  type="submit"
                  disabled={busy || !email.trim() || password.length < 6}
                >
                  {busy
                    ? emailMode === "signup"
                      ? "Creating…"
                      : "Signing in…"
                    : emailMode === "signup"
                      ? "Create account"
                      : "Sign in"}
                </button>
              </form>
            )}

            {mode === "social" && (
              <div className="auth-provider-stack">
                <button
                  type="button"
                  className="auth-provider-btn lumen-cta"
                  disabled={busy}
                  onClick={() => run(signInWithGoogle)}
                >
                  <GoogleIcon /> Continue with Google
                </button>
                <button
                  type="button"
                  className="auth-provider-btn lumen-cta"
                  disabled={busy}
                  onClick={() => run(signInWithGithub)}
                >
                  <GithubIcon /> Continue with GitHub
                </button>
                <button
                  type="button"
                  className="auth-provider-btn lumen-cta"
                  disabled={busy}
                  onClick={() => run(signInWithMicrosoft)}
                >
                  <MicrosoftIcon /> Continue with Microsoft
                </button>
              </div>
            )}

            {mode === "phone" && (
              <form className="auth-form" onSubmit={confirmation ? handleVerifyOtp : handleSendOtp}>
                <label className="field-label" htmlFor="phone-input">Phone number</label>
                <input
                  id="phone-input"
                  className="field-input"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={busy || !!confirmation}
                  required
                />

                {!confirmation && (
                  <button className="join-btn lumen-cta" type="submit" disabled={busy || !phone.trim()}>
                    {busy ? "Sending…" : "Send OTP"}
                  </button>
                )}

                {confirmation && (
                  <>
                    <label className="field-label" htmlFor="otp-input">OTP code</label>
                    <input
                      id="otp-input"
                      className="field-input"
                      placeholder="6-digit code"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={busy}
                      required
                    />
                    <label className="field-label" htmlFor="phone-name">Display name (optional)</label>
                    <input
                      id="phone-name"
                      className="field-input"
                      placeholder="Your name"
                      value={phoneName}
                      onChange={(e) => setPhoneName(e.target.value)}
                      disabled={busy}
                    />
                    <button className="join-btn lumen-cta" type="submit" disabled={busy || !otp.trim()}>
                      {busy ? "Verifying…" : "Verify & sign in"}
                    </button>
                    <button
                      type="button"
                      className="auth-link-btn"
                      disabled={busy}
                      onClick={() => {
                        setConfirmation(null);
                        setOtp("");
                      }}
                    >
                      Use a different number
                    </button>
                  </>
                )}
              </form>
            )}

            {mode === "guest" && (
              <form className="auth-form" onSubmit={handleGuest}>
                <label className="field-label" htmlFor="guest-name">Display name</label>
                <input
                  id="guest-name"
                  className="field-input"
                  placeholder="e.g. Priya"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  disabled={busy}
                  required
                />
                <button className="join-btn lumen-cta" type="submit" disabled={busy || !guestName.trim()}>
                  Continue as guest
                </button>
              </form>
            )}
          </>
        ) : (
          <form className="auth-form" onSubmit={handleGuest}>
            <div className="auth-setup-hint">
              Paste your Firebase web config into <code>frontend/.env</code>, then restart the frontend.
              Until then you can continue as a guest.
            </div>
            <label className="field-label" htmlFor="guest-name-fallback">Display name</label>
            <input
              id="guest-name-fallback"
              className="field-input"
              placeholder="e.g. Priya"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              disabled={busy}
              required
            />
            <button className="join-btn lumen-cta" type="submit" disabled={busy || !guestName.trim()}>
              Continue as guest
            </button>
          </form>
        )}

        {(authError || info) && (
          <div className={`auth-feedback ${authError ? "error" : "info"}`}>
            {authError || info}
          </div>
        )}

        <div id="recaptcha-container" />
        </div>
      </div>
    </div>
  );
}
