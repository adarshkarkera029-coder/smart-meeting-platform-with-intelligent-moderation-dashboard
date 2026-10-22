import { useEffect, useRef, useState, useCallback } from "react";
import { getIceServers } from "../lib/iceServers.js";
import { normalizeRoomId } from "../lib/roomId.js";

/**
 * Optimizes video sender encoding for multi-party mesh calls.
 * Caps bitrate at 500 kbps and maintains framerate so bandwidth & CPU are not saturated.
 */
function optimizeVideoSender(sender) {
  if (!sender) return;
  try {
    const params = sender.getParameters?.();
    if (params && params.encodings && params.encodings.length > 0) {
      params.encodings[0].maxBitrate = 500000; // 500 kbps per peer
      params.encodings[0].maxFramerate = 24;
      params.degradationPreference = "maintain-framerate";
      sender.setParameters(params).catch(() => {});
    }
  } catch {
    /* ignore unsupported browser methods */
  }
}

/**
 * Manages WebRTC peer connections for a multi-party mesh video call.
 * Uses W3C Perfect Negotiation to prevent offer collision (glare), pre-allocates
 * audio/video transceivers, enforces bitrate caps, and reacts to remote camera toggles.
 */
export function useWebRTC({ socket, roomId, name, localStream, ready = true }) {
  const [participants, setParticipants] = useState({}); // socketId -> { name, stream, speaking, camOn, isAdmin }
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const makingOfferRef = useRef({}); // socketId -> boolean
  const ignoreOfferRef = useRef({}); // socketId -> boolean
  const pendingIceRef = useRef({}); // peerId -> RTCIceCandidateInit[]
  const remoteStreamsRef = useRef({}); // peerId -> MediaStream (stable per-peer stream)
  const localStreamRef = useRef(localStream);
  localStreamRef.current = localStream;

  const flushIce = useCallback(async (peerId) => {
    const pc = peersRef.current[peerId];
    const queued = pendingIceRef.current[peerId] || [];
    if (!pc || !pc.remoteDescription || !queued.length) return;
    pendingIceRef.current[peerId] = [];
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!ignoreOfferRef.current[peerId]) {
          console.warn("[WebRTC] Failed to add queued ICE candidate", err);
        }
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId, peerName, peerMeta = {}) => {
      if (peersRef.current[peerId]) return peersRef.current[peerId];

      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      peersRef.current[peerId] = pc;
      makingOfferRef.current[peerId] = false;
      ignoreOfferRef.current[peerId] = false;

      // Attach local tracks or transceivers up front so both m=audio and m=video exist in SDP
      const stream = localStreamRef.current;
      const audioTrack = stream?.getAudioTracks()[0];
      const videoTrack = stream?.getVideoTracks().find((t) => t.readyState === "live");

      if (audioTrack) {
        pc.addTrack(audioTrack, stream);
      } else {
        try {
          pc.addTransceiver("audio", { direction: "sendrecv" });
        } catch {}
      }

      if (videoTrack) {
        const sender = pc.addTrack(videoTrack, stream);
        optimizeVideoSender(sender);
      } else {
        try {
          pc.addTransceiver("video", { direction: "sendrecv" });
        } catch {}
      }

      // Perfect negotiation: trigger offer on negotiationneeded
      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current[peerId] = true;
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable") return;
          await pc.setLocalDescription(offer);
          socket.current?.emit("signal:offer", {
            to: peerId,
            offer: pc.localDescription,
          });
        } catch (err) {
          console.warn("[WebRTC] Negotiation offer error", err);
        } finally {
          makingOfferRef.current[peerId] = false;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current?.emit("signal:ice-candidate", {
            to: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        let peerStream = event.streams[0];
        if (!peerStream) {
          peerStream = remoteStreamsRef.current[peerId] || new MediaStream();
          remoteStreamsRef.current[peerId] = peerStream;
          if (!peerStream.getTracks().includes(event.track)) {
            peerStream.addTrack(event.track);
          }
        } else {
          remoteStreamsRef.current[peerId] = peerStream;
        }

        setParticipants((prev) => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || {
              name: peerName,
              speaking: false,
              camOn: peerMeta.camOn !== false,
              isAdmin: !!peerMeta.isAdmin,
            }),
            stream: peerStream,
            lastTrackAt: Date.now(),
          },
        }));
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "failed") {
          try {
            pc.restartIce();
          } catch {
            /* ignore */
          }
        }
      };

      setParticipants((prev) => ({
        ...prev,
        [peerId]: prev[peerId] || {
          name: peerName,
          stream: null,
          speaking: false,
          camOn: peerMeta.camOn !== false,
          isAdmin: !!peerMeta.isAdmin,
        },
      }));

      return pc;
    },
    [socket]
  );

  // When local stream updates (e.g. fresh camera track acquired), update peer connections
  useEffect(() => {
    const stream = localStream;
    if (!stream) return;
    localStreamRef.current = stream;

    Object.values(peersRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        let sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (!sender) {
          const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
          const match = transceivers.find(
            (t) => t.sender?.track?.kind === track.kind || t.receiver?.track?.kind === track.kind
          );
          if (match) sender = match.sender;
        }

        if (sender) {
          if (sender.track !== track) {
            sender.replaceTrack(track).then(() => {
              if (track.kind === "video") optimizeVideoSender(sender);
            }).catch(() => {});
          }
        } else {
          try {
            const addedSender = pc.addTrack(track, stream);
            if (track.kind === "video") optimizeVideoSender(addedSender);
          } catch {
            /* ignore */
          }
        }
      });
    });
  }, [localStream]);

  useEffect(() => {
    const s = socket.current;
    const id = normalizeRoomId(roomId);
    if (!s || !id || !ready) return;

    const joinRoom = () => {
      if (!s.connected) return;
      s.emit("room:join", {
        roomId: id,
        name,
        camOn: localStream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live") ?? true,
      });
    };

    joinRoom();
    s.on("connect", joinRoom);
    s.io.on("reconnect", joinRoom);

    s.on("room:existing-participants", async (others) => {
      for (const other of others) {
        if (peersRef.current[other.socketId]) continue;
        const pc = createPeerConnection(other.socketId, other.name, other);
        try {
          makingOfferRef.current[other.socketId] = true;
          const offer = await pc.createOffer();
          if (pc.signalingState !== "stable") continue;
          await pc.setLocalDescription(offer);
          s.emit("signal:offer", { to: other.socketId, offer: pc.localDescription });
        } catch (err) {
          console.warn("[WebRTC] Failed to create initial offer", err);
        } finally {
          makingOfferRef.current[other.socketId] = false;
        }
      }
    });

    s.on("participant:joined", ({ socketId, name: peerName, isAdmin: peerAdmin, camOn: peerCamOn }) => {
      setParticipants((prev) => ({
        ...prev,
        [socketId]: prev[socketId] || {
          name: peerName,
          stream: null,
          speaking: false,
          isAdmin: !!peerAdmin,
          camOn: peerCamOn !== false,
        },
      }));
    });

    s.on("signal:offer", async ({ from, offer }) => {
      try {
        const pc = createPeerConnection(from, participants[from]?.name || "Guest");
        // Deterministic polite peer assignment
        const isPolite = s.id ? s.id < from : true;
        const offerCollision =
          offer.type === "offer" &&
          (makingOfferRef.current[from] || pc.signalingState !== "stable");

        ignoreOfferRef.current[from] = !isPolite && offerCollision;
        if (ignoreOfferRef.current[from]) {
          return;
        }

        if (offerCollision && isPolite) {
          await pc.setLocalDescription({ type: "rollback" });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("signal:answer", { to: from, answer: pc.localDescription });
      } catch (err) {
        console.warn("[WebRTC] Failed to handle offer", err);
      }
    });

    s.on("signal:answer", async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      try {
        if (pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushIce(from);
        }
      } catch (err) {
        console.warn("[WebRTC] Failed to apply answer", err);
      }
    });

    s.on("signal:ice-candidate", async ({ from, candidate }) => {
      if (!candidate) return;
      const pc = peersRef.current[from];
      if (!pc || !pc.remoteDescription) {
        pendingIceRef.current[from] = pendingIceRef.current[from] || [];
        pendingIceRef.current[from].push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        if (!ignoreOfferRef.current[from]) {
          console.warn("[WebRTC] Failed to add ICE candidate", err);
        }
      }
    });

    s.on("camera:toggled", ({ socketId, camOn }) => {
      setParticipants((prev) =>
        prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], camOn: !!camOn } } : prev
      );
    });

    s.on("participant:left", ({ socketId }) => {
      const pc = peersRef.current[socketId];
      if (pc) {
        pc.close();
        delete peersRef.current[socketId];
      }
      delete pendingIceRef.current[socketId];
      delete makingOfferRef.current[socketId];
      delete ignoreOfferRef.current[socketId];
      delete remoteStreamsRef.current[socketId];
      setParticipants((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    });

    s.on("speaking:start", ({ socketId }) => {
      setParticipants((prev) =>
        prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], speaking: true } } : prev
      );
    });

    s.on("speaking:stop", ({ socketId }) => {
      setParticipants((prev) =>
        prev[socketId] ? { ...prev, [socketId]: { ...prev[socketId], speaking: false } } : prev
      );
    });

    return () => {
      s.off("connect", joinRoom);
      s.io.off("reconnect", joinRoom);
      s.off("room:existing-participants");
      s.off("participant:joined");
      s.off("signal:offer");
      s.off("signal:answer");
      s.off("signal:ice-candidate");
      s.off("camera:toggled");
      s.off("participant:left");
      s.off("speaking:start");
      s.off("speaking:stop");
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      pendingIceRef.current = {};
      remoteStreamsRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, name, ready, createPeerConnection, flushIce]);

  const replaceVideoTrack = useCallback(async (newTrack) => {
    const promises = [];
    Object.values(peersRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      let videoSender = senders.find((s) => s.track?.kind === "video");
      if (!videoSender) {
        const transceivers = pc.getTransceivers ? pc.getTransceivers() : [];
        const videoTransceiver = transceivers.find(
          (t) => t.sender?.track?.kind === "video" || t.receiver?.track?.kind === "video"
        );
        if (videoTransceiver) {
          videoSender = videoTransceiver.sender;
        }
      }

      if (videoSender) {
        promises.push(
          videoSender.replaceTrack(newTrack).then(() => {
            if (newTrack) optimizeVideoSender(videoSender);
          }).catch((err) => {
            console.warn("[WebRTC] replaceTrack error", err);
          })
        );
      } else if (newTrack) {
        try {
          const stream = localStreamRef.current || new MediaStream([newTrack]);
          const sender = pc.addTrack(newTrack, stream);
          optimizeVideoSender(sender);
        } catch (err) {
          console.warn("[WebRTC] addTrack error", err);
        }
      }
    });
    await Promise.all(promises);
  }, []);

  return { participants, replaceVideoTrack };
}
