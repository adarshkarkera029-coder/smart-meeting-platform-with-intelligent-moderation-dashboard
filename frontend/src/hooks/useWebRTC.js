import { useEffect, useRef, useState, useCallback } from "react";
import { getIceServers } from "../lib/iceServers.js";
import { normalizeRoomId } from "../lib/roomId.js";

/**
 * Manages WebRTC peer connections for a mesh video call, using the given
 * socket for signaling. Returns remote participant state keyed by socketId.
 */
export function useWebRTC({ socket, roomId, name, localStream, ready = true }) {
  const [participants, setParticipants] = useState({}); // socketId -> { name, stream, speaking }
  const peersRef = useRef({}); // socketId -> RTCPeerConnection
  const pendingIceRef = useRef({}); // peerId -> RTCIceCandidateInit[]
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
        console.warn("Failed to add queued ICE candidate", err);
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId, peerName) => {
      if (peersRef.current[peerId]) return peersRef.current[peerId];

      const pc = new RTCPeerConnection({
        iceServers: getIceServers(),
        iceCandidatePoolSize: 2,
      });
      peersRef.current[peerId] = pc;

      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current?.emit("signal:ice-candidate", {
            to: peerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        setParticipants((prev) => ({
          ...prev,
          [peerId]: {
            ...(prev[peerId] || { name: peerName, speaking: false }),
            stream: event.streams[0],
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
        [peerId]: prev[peerId] || { name: peerName, stream: null, speaking: false },
      }));

      return pc;
    },
    [socket]
  );

  useEffect(() => {
    const stream = localStream;
    if (!stream) return;
    Object.values(peersRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      stream.getTracks().forEach((track) => {
        const sender = senders.find((s) => s.track && s.track.kind === track.kind);
        if (sender) {
          sender.replaceTrack(track).catch(() => {});
        } else {
          pc.addTrack(track, stream);
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
      s.emit("room:join", { roomId: id, name });
    };

    joinRoom();
    s.on("connect", joinRoom);
    s.io.on("reconnect", joinRoom);

    s.on("room:existing-participants", async (others) => {
      for (const other of others) {
        if (peersRef.current[other.socketId]) continue;
        const pc = createPeerConnection(other.socketId, other.name);
        try {
          const offer = await pc.createOffer({ iceRestart: true });
          await pc.setLocalDescription(offer);
          s.emit("signal:offer", { to: other.socketId, offer });
        } catch (err) {
          console.warn("Failed to create offer", err);
        }
      }
    });

    s.on("participant:joined", ({ socketId, name: peerName }) => {
      setParticipants((prev) => ({
        ...prev,
        [socketId]: prev[socketId] || { name: peerName, stream: null, speaking: false },
      }));
    });

    s.on("signal:offer", async ({ from, offer }) => {
      try {
        const pc = createPeerConnection(from, participants[from]?.name || "Guest");
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        await flushIce(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        s.emit("signal:answer", { to: from, answer });
      } catch (err) {
        console.warn("Failed to handle offer", err);
      }
    });

    s.on("signal:answer", async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await flushIce(from);
      } catch (err) {
        console.warn("Failed to apply answer", err);
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
        console.warn("Failed to add ICE candidate", err);
      }
    });

    s.on("participant:left", ({ socketId }) => {
      const pc = peersRef.current[socketId];
      if (pc) {
        pc.close();
        delete peersRef.current[socketId];
      }
      delete pendingIceRef.current[socketId];
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
      s.off("participant:left");
      s.off("speaking:start");
      s.off("speaking:stop");
      Object.values(peersRef.current).forEach((pc) => pc.close());
      peersRef.current = {};
      pendingIceRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, name, ready, createPeerConnection, flushIce]);

  const replaceVideoTrack = useCallback(async (newTrack) => {
    const promises = [];
    Object.values(peersRef.current).forEach((pc) => {
      const senders = pc.getSenders();
      const videoSender = senders.find((s) => s.track && s.track.kind === "video");
      if (videoSender) {
        promises.push(videoSender.replaceTrack(newTrack).catch(() => {}));
      }
    });
    await Promise.all(promises);
  }, []);

  return { participants, replaceVideoTrack };
}
