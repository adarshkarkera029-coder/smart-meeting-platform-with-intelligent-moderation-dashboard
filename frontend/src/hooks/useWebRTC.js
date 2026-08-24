import { useEffect, useRef, useState, useCallback } from "react";

const ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

/**
 * Manages WebRTC peer connections for a mesh video call, using the given
 * socket for signaling. Returns remote participant state keyed by socketId.
 */
export function useWebRTC({ socket, roomId, name, localStream }) {
  const [participants, setParticipants] = useState({}); // socketId -> { name, stream, speaking }
  const peersRef = useRef({}); // socketId -> RTCPeerConnection

  const createPeerConnection = useCallback(
    (peerId, peerName) => {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current[peerId] = pc;

      if (localStream) {
        localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
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
        if (["failed", "closed", "disconnected"].includes(pc.connectionState)) {
          // leave cleanup to participant:left handler
        }
      };

      setParticipants((prev) => ({
        ...prev,
        [peerId]: prev[peerId] || { name: peerName, stream: null, speaking: false },
      }));

      return pc;
    },
    [localStream, socket]
  );

  useEffect(() => {
    if (!socket.current || !roomId || !localStream) return;
    const s = socket.current;

    const joinRoom = () => {
      s.emit("room:join", { roomId, name });
    };

    joinRoom();
    s.on("connect", joinRoom);

    s.on("room:existing-participants", async (others) => {
      for (const other of others) {
        if (peersRef.current[other.socketId]) continue;
        const pc = createPeerConnection(other.socketId, other.name);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        s.emit("signal:offer", { to: other.socketId, offer });
      }
    });

    s.on("participant:joined", ({ socketId, name: peerName }) => {
      setParticipants((prev) => ({
        ...prev,
        [socketId]: prev[socketId] || { name: peerName, stream: null, speaking: false },
      }));
    });

    s.on("signal:offer", async ({ from, offer }) => {
      const pc = createPeerConnection(from, participants[from]?.name || "Guest");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      s.emit("signal:answer", { to: from, answer });
    });

    s.on("signal:answer", async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    s.on("signal:ice-candidate", async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn("Failed to add ICE candidate", err);
        }
      }
    });

    s.on("participant:left", ({ socketId }) => {
      const pc = peersRef.current[socketId];
      if (pc) {
        pc.close();
        delete peersRef.current[socketId];
      }
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, roomId, localStream, name, createPeerConnection]);

  return { participants };
}
