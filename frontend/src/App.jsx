import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "./hooks/useSocket.js";
import { useWebRTC } from "./hooks/useWebRTC.js";
import { useAudioPipeline } from "./hooks/useAudioPipeline.js";
import { useAuth } from "./lib/AuthContext.jsx";
import { useTheme } from "./lib/ThemeContext.jsx";

import VideoGrid from "./components/VideoGrid.jsx";
import MicControls from "./components/MicControls.jsx";
import SpeakerDashboard from "./components/SpeakerDashboard.jsx";
import SummaryPanel from "./components/SummaryPanel.jsx";
import ChatPanel from "./components/ChatPanel.jsx";
import InviteModal from "./components/InviteModal.jsx";
import CalendarModal from "./components/CalendarModal.jsx";
import MailModal from "./components/MailModal.jsx";
import AuthScreen from "./components/AuthScreen.jsx";
import FluidCursor from "./components/FluidCursor.jsx";
import AuroraBackdrop from "./components/AuroraBackdrop.jsx";
import BrandMark from "./components/BrandMark.jsx";
import GestureControls from "./components/GestureControls.jsx";
import { useGestureRecognition } from "./gestures/useGestureRecognition.js";
import { useMobileFormScroll } from "./hooks/useMobileFormScroll.js";
import { normalizeRoomId } from "./lib/roomId.js";

function getRoomFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomId(params.get("room") || "");
}

function persistRoomInUrl(id) {
  const next = normalizeRoomId(id);
  if (!next) return "";
  const url = new URL(window.location.href);
  url.searchParams.set("room", next);
  window.history.replaceState({}, "", url);
  return next;
}

export default function App() {
  const { user, loading } = useAuth();
  const [roomId, setRoomId] = useState(getRoomFromUrl());
  const [joined, setJoined] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (user?.name && !name) setName(user.name);
  }, [user, name]);

  let screen;
  if (loading) {
    screen = (
      <div className="boot-screen">
        <BrandMark size={44} />
        <div className="boot-spinner" />
        <p>Warming the room…</p>
      </div>
    );
  } else if (!user) {
    screen = <AuthScreen />;
  } else if (!joined) {
    screen = (
      <JoinScreen
        roomId={roomId}
        setRoomId={setRoomId}
        name={name}
        setName={setName}
        onJoin={() => {
          const id = persistRoomInUrl(roomId);
          if (!id) return;
          setRoomId(id);
          setJoined(true);
        }}
      />
    );
  } else {
    screen = (
      <Meeting
        roomId={roomId}
        name={name || user.name || "Guest"}
        onLeave={() => setJoined(false)}
      />
    );
  }

  return (
    <>
      <AuroraBackdrop intense />
      {!joined && <FluidCursor />}
      {screen}
    </>
  );
}

function makeRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function JoinScreen({ roomId, setRoomId, name, setName, onJoin }) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const screenRef = useRef(null);
  useMobileFormScroll(screenRef);
  const canJoin = normalizeRoomId(roomId).length > 0 && name.trim().length > 0;
  const hasRoomFromUrl = !!new URLSearchParams(window.location.search).get("room");

  return (
    <div className="join-screen lumen-screen" ref={screenRef}>
      <div className="theme-fab-group" role="group" aria-label="Theme">
        <button
          type="button"
          className={`theme-fab theme-fab-light ${theme === "light" ? "active" : ""}`}
          onClick={() => setTheme("light")}
          title="Light mode"
          aria-pressed={theme === "light"}
        >
          {SidebarIcons.sun}
        </button>
        <button
          type="button"
          className={`theme-fab theme-fab-dark ${theme === "dark" ? "active" : ""}`}
          onClick={() => setTheme("dark")}
          title="Dark mode"
          aria-pressed={theme === "dark"}
        >
          {SidebarIcons.moon}
        </button>
      </div>
      <div className="lumen-shell">
        <section className="lumen-visual">
          <div className="brand brand-hero">
            <BrandMark size={36} />
            <span className="brand-name">Meet</span>
          </div>
          <p className="lumen-kicker">{timeGreeting()}</p>
          <h1 className="lumen-display">
            {hasRoomFromUrl ? "Your room is waiting." : "Step into the room."}
          </h1>
          <p className="lumen-lead">
            A studio-grade call with a live AI dashboard — who said what, as it happens.
          </p>
          <div className="lumen-bento">
            <article className="bento-card bento-wide">
              <span className="bento-icon">✦</span>
              <strong>Live speaker notes</strong>
              <p>Each voice becomes a card. Pause, and the summary catches up.</p>
            </article>
            <article className="bento-card">
              <span className="bento-icon">◎</span>
              <strong>Share a code</strong>
              <p>Or drop an invite link.</p>
            </article>
            <article className="bento-card">
              <span className="bento-icon">◌</span>
              <strong>Email the recap</strong>
              <p>Send notes when you wrap.</p>
            </article>
          </div>
        </section>
        <div className="join-card join-card-enter lumen-panel" data-fluid-ignore>
        <div className="join-card-top">
          <div className="brand">
            <BrandMark size={28} />
            <span className="brand-name">Meet</span>
          </div>
          <button
            type="button"
            className="auth-link-btn signout-inline"
            onClick={() => {
              setName("");
              signOut();
            }}
          >
            Sign out
          </button>
        </div>

        <div className="join-user-chip">
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" className="join-user-avatar" />
          ) : (
            <span className="join-user-initials">
              {(name || user?.name || "?").slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <div className="join-user-name">{user?.name}</div>
            <div className="join-user-meta">
              {user?.isGuest
                ? "Guest session"
                : user?.email || user?.phone || user?.provider}
            </div>
          </div>
        </div>

        <h1 className="join-title">{hasRoomFromUrl ? "Join this room" : "Start or join"}</h1>
        <p className="join-sub">
          Hosts and guests land in the same call when they use the same classroom code.
        </p>

        {hasRoomFromUrl && (
          <div className="join-invited-badge">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            You've been invited to join <strong>{roomId}</strong>
          </div>
        )}

        <form
          className="join-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (canJoin) onJoin();
          }}
        >
          <label className="field-label" htmlFor="room-input">
            {hasRoomFromUrl ? "Room (from invite link)" : "Room code"}
          </label>
          <div className="field-row">
            <input
              id="room-input"
              className="field-input"
              placeholder="e.g. 582914"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            {!hasRoomFromUrl && (
              <button
                type="button"
                className="ghost-chip-btn"
                onClick={() => setRoomId(makeRoomCode())}
              >
                Generate
              </button>
            )}
          </div>

          {!hasRoomFromUrl && (
            <p className="join-code-hint">
              Share this exact code with your friend. Guest login works — they just need the same room id.
            </p>
          )}

          <label className="field-label" htmlFor="name-input">Your name in the call</label>
          <input
            id="name-input"
            className="field-input"
            placeholder="e.g. Priya"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <button className="join-btn lumen-cta" type="submit" disabled={!canJoin}>
            Enter the room
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

function MeetingClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="island-clock">
      {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

/* ── Sidebar Icons (SVG) ────────────────────────────────────────── */
const SidebarIcons = {
  logo: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M13 3L4 14h7l-2 7 9-11h-7l2-7z" fill="currentColor" />
    </svg>
  ),
  chat: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  video: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="2" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  mail: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M22 7l-10 7L2 7" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
  sun: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  moon: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path d="M21 14.5A8.5 8.5 0 1110.5 3 7 7 0 0021 14.5z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  ),
};

/* ── Header Icons (SVG) ─────────────────────────────────────────── */
const HeaderIcons = {
  back: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  layout: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18M9 9v12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  bell: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
  link: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  ),
};

function Meeting({ roomId, name, onLeave }) {
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { socket, connected } = useSocket();

  const [localStream, setLocalStream] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMail, setShowMail] = useState(false);
  const [layoutMode, setLayoutMode] = useState("grid");
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminSocketId, setAdminSocketId] = useState(null);
  const [adminLeftNotice, setAdminLeftNotice] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const [micStatus, setMicStatus] = useState("requesting");
  const [listening, setListening] = useState(true);

  // Detection + safety on by default; debug stays off (landmarks are expensive)
  const [gesturePanelOpen, setGesturePanelOpen] = useState(false);
  const [gestureEnabled, setGestureEnabled] = useState(true);
  const [safetyEnabled, setSafetyEnabled] = useState(true);
  const [gestureDebug, setGestureDebug] = useState(false);
  const localVideoRef = useRef(null);
  const setLocalVideoEl = useCallback((el) => {
    localVideoRef.current = el;
  }, []);

  const [speakerPoints, setSpeakerPoints] = useState({});
  const [summary, setSummary] = useState({ bullets: [], updatedAt: null });
  const [moderation, setModeration] = useState([]);
  const [streamingPoints, setStreamingPoints] = useState({});

  const [chatMessages, setChatMessages] = useState([]);
  const [blockedMessage, setBlockedMessage] = useState(null);
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== "undefined" && window.innerWidth <= 768 ? null : "summary"
  );
  const [unreadChat, setUnreadChat] = useState(0);

  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    let cancelled = false;
    setMicStatus("requesting");

    const constraints = {
      video: {
        width: { ideal: 640, max: 854 },
        height: { ideal: 360, max: 480 },
        frameRate: { ideal: 24, max: 24 },
      },
      audio: {
        noiseSuppression: true,
        echoCancellation: true,
        autoGainControl: true,
        channelCount: 1,
        sampleRate: 48000,
      },
    };

    navigator.mediaDevices
      .getUserMedia(constraints)
      .catch(() => navigator.mediaDevices.getUserMedia({ video: true, audio: true }))
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        setLocalStream(stream);
        setMicStatus("active");
      })
      .catch(() => {
        if (!cancelled) setMicStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      socket.current?.emit("room:leave");
    };
  }, [socket]);

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach((t) => t.stop());
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [localStream]);

  const mediaReady = Boolean(localStream) || micStatus === "error";
  const { participants, replaceVideoTrack } = useWebRTC({
    socket,
    roomId,
    name,
    localStream,
    ready: mediaReady,
  });

  const { isSpeaking, level, pipelineError } = useAudioPipeline({
    socket,
    roomId,
    name,
    stream: localStream,
    listening,
  });

  const gesture = useGestureRecognition({
    videoRef: localVideoRef,
    stream: localStream,
    camOn,
    setCamOn,
    gestureEnabled,
    safetyEnabled,
    debugMode: gestureDebug,
  });

  useEffect(() => {
    if (!socket.current) return;
    const s = socket.current;

    const onSnapshot = (snap) => {
      if (!snap) return;
      setSpeakerPoints(snap.speakerPoints || {});
      setSummary(snap.summary || { bullets: [], updatedAt: null });
      setModeration(snap.moderation || []);
    };

    const onPoint = ({ speaker, point }) => {
      if (point.pointId) {
        setStreamingPoints((prev) => {
          const next = { ...prev };
          delete next[point.pointId];
          return next;
        });
      }
      setSpeakerPoints((prev) => {
        const existing = prev[speaker] || [];
        return { ...prev, [speaker]: [point, ...existing] };
      });
    };

    const onToken = ({ speaker, token, pointId, replace }) => {
      setStreamingPoints((prev) => ({
        ...prev,
        [pointId]: {
          speaker,
          text: replace ? token : (prev[pointId]?.text ?? "") + token,
        },
      }));
    };

    const onSummary = (s2) => setSummary(s2);
    const onModAlert = (alert) => setModeration((prev) => [...prev, alert]);
    const onReset = () => {
      setSpeakerPoints({});
      setSummary({ bullets: [], updatedAt: null });
      setModeration([]);
      setStreamingPoints({});
      setChatMessages([]);
    };

    const onChatMessage = (msg) => {
      setChatMessages((prev) => [...prev, msg]);
      if (activeTabRef.current !== "chat") {
        setUnreadChat((prev) => prev + 1);
      }
    };

    const onChatHistory = (history) => {
      setChatMessages(history);
    };

    const onChatBlocked = (data) => {
      setBlockedMessage(data);
      setTimeout(() => setBlockedMessage(null), 4000);
    };

    const onHandToggled = ({ socketId, raised }) => {
      setRaisedHands((prev) => ({ ...prev, [socketId]: raised }));
    };

    const onMuteRequest = () => {
      if (localStream) {
        localStream.getAudioTracks().forEach((t) => {
          t.enabled = false;
        });
      }
      setMicOn(false);
    };

    const onRole = ({ isAdmin: roleAdmin, adminSocketId: aId, gestureEnabled: gEnabled }) => {
      setIsAdmin(!!roleAdmin);
      if (aId) setAdminSocketId(aId);
      if (typeof gEnabled === "boolean") setGestureEnabled(gEnabled);
    };

    const onAdminUpdated = ({ adminSocketId: aId }) => {
      setAdminSocketId(aId);
      setIsAdmin(socket.current?.id === aId);
    };

    const onGestureRoomState = ({ enabled }) => {
      setGestureEnabled(enabled);
    };

    const onAdminLeft = ({ adminName }) => {
      setAdminLeftNotice({ adminName: adminName || "Meeting Host" });
    };

    const onKicked = ({ reason }) => {
      alert(reason || "You were removed from the meeting by the host.");
      onLeave();
    };

    s.on("dashboard:snapshot", onSnapshot);
    s.on("dashboard:point", onPoint);
    s.on("dashboard:point:token", onToken);
    s.on("summary:update", onSummary);
    s.on("dashboard:moderation", onModAlert);
    s.on("moderation:alert", onModAlert);
    s.on("room:reset", onReset);
    s.on("chat:message", onChatMessage);
    s.on("chat:history", onChatHistory);
    s.on("chat:blocked", onChatBlocked);
    s.on("hand:toggled", onHandToggled);
    s.on("room:mute-request", onMuteRequest);
    s.on("room:role", onRole);
    s.on("room:admin-updated", onAdminUpdated);
    s.on("room:admin-left", onAdminLeft);
    s.on("gesture:room-state", onGestureRoomState);
    s.on("room:kicked", onKicked);

    return () => {
      s.off("dashboard:snapshot", onSnapshot);
      s.off("dashboard:point", onPoint);
      s.off("dashboard:point:token", onToken);
      s.off("summary:update", onSummary);
      s.off("dashboard:moderation", onModAlert);
      s.off("moderation:alert", onModAlert);
      s.off("room:reset", onReset);
      s.off("chat:message", onChatMessage);
      s.off("chat:history", onChatHistory);
      s.off("chat:blocked", onChatBlocked);
      s.off("hand:toggled", onHandToggled);
      s.off("room:mute-request", onMuteRequest);
      s.off("room:role", onRole);
      s.off("room:admin-updated", onAdminUpdated);
      s.off("room:admin-left", onAdminLeft);
      s.off("gesture:room-state", onGestureRoomState);
      s.off("room:kicked", onKicked);
    };
  }, [socket, connected, localStream, onLeave]);

  const sendChatMessage = (text) => {
    if (!text.trim()) return false;
    if (!socket.current?.connected) {
      setBlockedMessage({ reason: "Not connected to server. Wait for “connected”, then try again." });
      setTimeout(() => setBlockedMessage(null), 4000);
      return false;
    }
    socket.current.emit("chat:send", { roomId: normalizeRoomId(roomId), text: text.trim() });
    return true;
  };

  const toggleMic = useCallback(() => {
    if (!localStream) return;
    const next = !micOn;
    localStream.getAudioTracks().forEach((t) => (t.enabled = next));
    setMicOn(next);
  }, [localStream, micOn]);

  useEffect(() => {
    socket.current?.emit("camera:toggle", { camOn });
  }, [camOn, socket]);

  const toggleCam = useCallback(async () => {
    const next = !camOn;
    if (next) {
      let videoTrack = localStream?.getVideoTracks().find((t) => t.readyState === "live");
      if (!videoTrack) {
        try {
          const freshMedia = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640, max: 854 },
              height: { ideal: 360, max: 480 },
              frameRate: { ideal: 24, max: 24 },
            },
          });
          videoTrack = freshMedia.getVideoTracks()[0];
          if (videoTrack) {
            if (localStream) {
              localStream.getVideoTracks().forEach((oldT) => {
                try { oldT.stop(); } catch {}
                try { localStream.removeTrack(oldT); } catch {}
              });
              localStream.addTrack(videoTrack);
            } else {
              setLocalStream(freshMedia);
            }
          }
        } catch (err) {
          console.warn("[Media] Failed to get camera video track", err);
          alert("Could not access camera. Please check camera device permissions.");
          return;
        }
      }

      if (videoTrack) {
        videoTrack.enabled = true;
        await replaceVideoTrack(videoTrack);
      }
      setCamOn(true);
      socket.current?.emit("camera:toggle", { camOn: true });
    } else {
      localStream?.getVideoTracks().forEach((t) => {
        t.enabled = false;
      });
      setCamOn(false);
      socket.current?.emit("camera:toggle", { camOn: false });
    }
  }, [localStream, camOn, replaceVideoTrack, socket]);

  const toggleHand = useCallback(() => {
    setHandRaised((prev) => {
      const next = !prev;
      socket.current?.emit("hand:toggle", { raised: next });
      return next;
    });
  }, [socket]);

  const handleToggleGesture = useCallback((nextEnabled) => {
    if (!isAdmin) return;
    setGestureEnabled(nextEnabled);
    socket.current?.emit("gesture:toggle-room", { enabled: nextEnabled });
  }, [isAdmin, socket]);

  const handleKickParticipant = useCallback((targetSocketId) => {
    if (!isAdmin || !targetSocketId) return;
    socket.current?.emit("room:kick-participant", { targetSocketId });
  }, [isAdmin, socket]);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }
    setScreenSharing(false);
    const camTrack = localStream?.getVideoTracks()?.[0];
    if (camTrack && replaceVideoTrack) {
      replaceVideoTrack(camTrack);
    }
  }, [localStream, replaceVideoTrack]);

  const toggleScreenShare = useCallback(async () => {
    if (screenSharing) {
      stopScreenShare();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        alert("Screen sharing is not supported in this browser.");
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });
      screenStreamRef.current = stream;
      const screenTrack = stream.getVideoTracks()[0];
      if (screenTrack) {
        screenTrack.onended = () => {
          stopScreenShare();
        };
        if (replaceVideoTrack) {
          await replaceVideoTrack(screenTrack);
        }
      }
      setScreenSharing(true);
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        console.warn("Screen share error:", err);
      }
    }
  }, [screenSharing, stopScreenShare, replaceVideoTrack]);

  const handleMuteAll = useCallback(() => {
    socket.current?.emit("room:mute-all");
  }, [socket]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "m") {
        e.preventDefault();
        toggleMic();
      } else if (key === "v") {
        e.preventDefault();
        toggleCam();
      } else if (key === "h") {
        e.preventDefault();
        toggleHand();
      } else if (key === "c") {
        e.preventDefault();
        setActiveTab((curr) => (curr === "chat" ? null : "chat"));
        setUnreadChat(0);
      } else if (key === "s") {
        e.preventDefault();
        setActiveTab((curr) => (curr === "summary" ? null : "summary"));
      } else if (e.key === "Escape") {
        setShowInvite(false);
        setShowCalendar(false);
        setShowMail(false);
        setGesturePanelOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleMic, toggleCam, toggleHand]);

  const toggleInvite = () => setShowInvite((v) => !v);

  const initials = (n) =>
    n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

  const peopleCount = Object.keys(participants).length + 1;

  return (
    <div className="app app-enter">
      <aside className="sidebar">
        <button
          type="button"
          className="sidebar-logo"
          onClick={onLeave}
          title="Back to home"
        >
          <BrandMark size={22} />
        </button>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`sidebar-icon sidebar-icon-chat ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => { setActiveTab("chat"); setUnreadChat(0); }}
            title="Chat"
          >
            {SidebarIcons.chat}
            {unreadChat > 0 && <span className="sidebar-unread">{unreadChat}</span>}
          </button>
          <button
            type="button"
            className={`sidebar-icon sidebar-icon-summary ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
            title="AI Summary"
          >
            {SidebarIcons.video}
          </button>
          <button
            type="button"
            className={`sidebar-icon sidebar-icon-calendar ${showCalendar ? "active" : ""}`}
            onClick={() => setShowCalendar(true)}
            title="Calendar"
          >
            {SidebarIcons.calendar}
          </button>
          <button
            type="button"
            className={`sidebar-icon sidebar-icon-mail ${showMail ? "active" : ""}`}
            onClick={() => setShowMail(true)}
            title="Email summary"
          >
            {SidebarIcons.mail}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <button
            type="button"
            className={`sidebar-icon sidebar-icon-light ${theme === "light" ? "active" : ""}`}
            onClick={() => setTheme("light")}
            title="Light mode"
            aria-pressed={theme === "light"}
          >
            {SidebarIcons.sun}
          </button>
          <button
            type="button"
            className={`sidebar-icon sidebar-icon-dark ${theme === "dark" ? "active" : ""}`}
            onClick={() => setTheme("dark")}
            title="Dark mode"
            aria-pressed={theme === "dark"}
          >
            {SidebarIcons.moon}
          </button>
          {user && (
            <button
              type="button"
              className="sidebar-icon sidebar-icon-logout"
              onClick={() => {
                signOut();
                onLeave();
              }}
              title={`Sign out (${user.email || user.phoneNumber || user.displayName || "User"})`}
              aria-label="Sign out"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </aside>

      <div className="main-area">
        <header className="meeting-header">
          <div className="header-left">
            <button className="back-btn" onClick={onLeave} title="Leave meeting">
              {HeaderIcons.back}
            </button>
            <div className="meeting-title-wrap">
              <h1 className="meeting-title">{roomId || "Meeting Room"}</h1>
              <span className="meeting-people">{peopleCount} {peopleCount === 1 ? "person" : "people"}</span>
            </div>
          </div>

          <div className={`status-island ${connected ? "is-live" : "is-wait"}`} title={connected ? "Connected" : "Connecting"}>
            <span className={`status-dot ${connected ? "connected" : "disconnected"}`} />
            <span className="island-label">{connected ? "Live" : "Connecting"}</span>
            <span className="island-sep" />
            <MeetingClock />
          </div>

          <div className="header-right">
            {pipelineError && (
              <span className="mono header-error">
                {pipelineError}
              </span>
            )}

            <div className="header-actions">
              <button className={`header-icon-btn ${layoutMode === "grid" ? "active" : ""}`} onClick={() => setLayoutMode("grid")} title="Grid view">{HeaderIcons.grid}</button>
              <button className={`header-icon-btn ${layoutMode === "spotlight" ? "active" : ""}`} onClick={() => setLayoutMode("spotlight")} title="Layout">{HeaderIcons.layout}</button>
              <button className={`header-icon-btn ${showInvite ? "active" : ""}`} onClick={toggleInvite} title="Invite people">
                {HeaderIcons.link}
              </button>
            </div>

            <div className="header-divider" />
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="header-avatar-img" title={name} />
            ) : (
              <div className="header-avatar" title={name}>{initials(name)}</div>
            )}
          </div>
        </header>

        <div className="main-content">
          <div className="video-section">
            <VideoGrid
              localName={name}
              localStream={localStream}
              localSpeaking={isSpeaking}
              localLevel={level}
              micOn={micOn}
              camOn={camOn}
              localHandRaised={handRaised}
              raisedHands={raisedHands}
              isAdmin={isAdmin}
              adminSocketId={adminSocketId}
              onKickParticipant={handleKickParticipant}
              participants={participants}
              layoutMode={layoutMode}
              onLayoutModeChange={setLayoutMode}
              onLocalVideoRef={setLocalVideoEl}
              gestureOverlayProps={
                gestureEnabled && gesture.status === "ready"
                  ? {
                      visible: true,
                      gestureLabel: gesture.gestureLabel,
                      confidence: gesture.confidence,
                      holdProgress: safetyEnabled ? gesture.holdProgress : 0,
                      debugMode: gestureDebug,
                      debugInfoRef: gesture.debugInfoRef,
                    }
                  : null
              }
            />
            <GestureControls
              open={gesturePanelOpen}
              onToggleOpen={() => setGesturePanelOpen((v) => !v)}
              gestureEnabled={gestureEnabled}
              onToggleGesture={handleToggleGesture}
              safetyEnabled={safetyEnabled}
              onToggleSafety={setSafetyEnabled}
              debugMode={gestureDebug}
              onToggleDebug={setGestureDebug}
              gestureLabel={gesture.gestureLabel}
              confidence={gesture.confidence}
              status={gesture.status}
              statusMessage={gesture.statusMessage}
              safetyNotice={gesture.safetyNotice}
              onReenableCamera={gesture.reenableCamera}
              onDismissNotice={gesture.clearSafetyNotice}
              isAdmin={isAdmin}
            />
          </div>

          {activeTab && (
            <div className="right-panel">
              <div className="right-panel-inner">
                <div className="panel-tabs">
                  <button
                    className={`panel-tab ${activeTab === "summary" ? "active" : ""}`}
                    onClick={() => setActiveTab("summary")}
                  >
                    <span className="panel-tab-icon">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26A7 7 0 0012 2z" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        <circle cx="10" cy="10" r="1" fill="currentColor" />
                        <circle cx="14" cy="10" r="1" fill="currentColor" />
                      </svg>
                    </span>
                    AI Summary
                  </button>
                  <button
                    className={`panel-tab ${activeTab === "chat" ? "active" : ""}`}
                    onClick={() => { setActiveTab("chat"); setUnreadChat(0); }}
                  >
                    <span className="panel-tab-icon">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                      </svg>
                    </span>
                    Chat
                    {unreadChat > 0 && <span className="panel-tab-badge">{unreadChat}</span>}
                  </button>
                  <button
                    type="button"
                    className="panel-close-btn"
                    onClick={() => setActiveTab(null)}
                    title="Close panel"
                    aria-label="Close panel"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

              {activeTab === "summary" ? (
                <>
                  <div className="dashboard-header">
                    <p className="dashboard-title">
                      <span className="dashboard-title-icon">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path d="M12 2a7 7 0 00-7 7c0 2.38 1.19 4.47 3 5.74V17a2 2 0 002 2h4a2 2 0 002-2v-2.26A7 7 0 0012 2z" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 21h6M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <circle cx="10" cy="10" r="1" fill="currentColor" />
                          <circle cx="14" cy="10" r="1" fill="currentColor" />
                        </svg>
                      </span>
                      AI Meeting Summary
                    </p>
                    <div className="dashboard-header-actions">
                      <span className="live-badge">
                        <span className="live-badge-dot" />
                        LIVE
                      </span>
                    </div>
                  </div>
                  {!connected && (
                    <div className="panel-connection-banner">
                      Reconnecting to server… AI notes will appear once connected.
                    </div>
                  )}
                  <div className="dashboard-body">
                    <SummaryPanel summary={summary} />
                    <SpeakerDashboard speakerPoints={speakerPoints} streamingPoints={streamingPoints} />
                  </div>
                </>
              ) : (
                <ChatPanel
                  messages={chatMessages}
                  onSend={sendChatMessage}
                  blockedMessage={blockedMessage}
                  currentUser={name}
                  connected={connected}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>

      <MicControls
        micOn={micOn}
        onToggleMic={toggleMic}
        camOn={camOn}
        onToggleCam={toggleCam}
        listening={listening}
        onToggleListening={() => setListening((v) => !v)}
        handRaised={handRaised}
        onToggleHand={toggleHand}
        screenSharing={screenSharing}
        onToggleScreenShare={toggleScreenShare}
        onMuteAll={handleMuteAll}
        chatOpen={activeTab === "chat"}
        onToggleChat={() => {
          setActiveTab((curr) => (curr === "chat" ? null : "chat"));
          setUnreadChat(0);
        }}
        unreadChat={unreadChat}
        micStatus={micStatus}
        onLeave={onLeave}
        name={name}
        level={level}
        isSpeaking={isSpeaking}
        connected={connected}
      />

      {showInvite && (
        <InviteModal roomId={roomId} onClose={() => setShowInvite(false)} />
      )}
      {showCalendar && (
        <CalendarModal onClose={() => setShowCalendar(false)} />
      )}
      {showMail && (
        <MailModal
          roomId={roomId}
          summary={summary}
          sentBy={name}
          defaultEmail={user?.email || ""}
          onClose={() => setShowMail(false)}
        />
      )}

      {adminLeftNotice && (
        <div className="admin-left-backdrop" role="dialog" aria-modal="true">
          <div className="admin-left-card">
            <div className="admin-left-icon-badge">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="8.5" cy="7" r="4" stroke="currentColor" strokeWidth="2"/>
                <path d="M17 9l5 5m0-5l-5 5" stroke="#ef4444" strokeWidth="2.4" strokeLinecap="round"/>
              </svg>
            </div>
            <h3 className="admin-left-title">Host Left the Meeting</h3>
            <p className="admin-left-desc">
              <strong>{adminLeftNotice.adminName}</strong> (the meeting host) has left the room.
              Would you like to end the meeting or continue staying in the call?
            </p>
            <div className="admin-left-actions">
              <button
                type="button"
                className="admin-left-btn danger"
                onClick={() => {
                  setAdminLeftNotice(null);
                  onLeave();
                }}
              >
                End Meeting
              </button>
              <button
                type="button"
                className="admin-left-btn primary"
                onClick={() => setAdminLeftNotice(null)}
              >
                Stay in Meeting
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
