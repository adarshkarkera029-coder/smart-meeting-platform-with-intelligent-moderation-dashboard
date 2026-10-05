import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { resolveBackendUrl } from "../lib/backendUrl.js";

let sharedSocket = null;

function createSocket() {
  const url = resolveBackendUrl();
  return io(url, {
    path: "/socket.io",
    // Polling first, then upgrade — survives proxies that break raw WS.
    transports: ["polling", "websocket"],
    upgrade: true,
    // Firebase auth is header/token based; cookies on XHR polling cause
    // CORS connect_error loops that look like "reconnecting forever".
    withCredentials: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 4000,
    timeout: 20000,
    autoConnect: true,
  });
}

function getSocket() {
  if (!sharedSocket) sharedSocket = createSocket();
  return sharedSocket;
}

export function useSocket() {
  const socketRef = useRef(null);
  if (!socketRef.current) socketRef.current = getSocket();

  const [connected, setConnected] = useState(() => Boolean(socketRef.current?.connected));

  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    const sync = () => setConnected(Boolean(socket.connected));

    const onError = (err) => {
      console.warn("[socket] connect_error", err?.message || err);
      // Upgrade failures must not flip the UI if polling is still alive.
      sync();
    };

    socket.on("connect", sync);
    socket.on("disconnect", sync);
    socket.io.on("reconnect", sync);
    socket.on("connect_error", onError);

    if (!socket.connected) socket.connect();
    sync();

    return () => {
      socket.off("connect", sync);
      socket.off("disconnect", sync);
      socket.off("connect_error", onError);
      socket.io.off("reconnect", sync);
    };
  }, []);

  return { socket: socketRef, connected };
}
