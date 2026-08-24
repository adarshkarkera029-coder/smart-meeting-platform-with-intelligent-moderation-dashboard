import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

export function useSocket() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = io(BACKEND_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });
    socketRef.current = socket;

    const markConnected = () => setConnected(true);
    const markDisconnected = () => setConnected(false);

    socket.on("connect", markConnected);
    socket.on("disconnect", markDisconnected);
    socket.on("connect_error", markDisconnected);

    if (socket.connected) markConnected();

    return () => {
      socket.off("connect", markConnected);
      socket.off("disconnect", markDisconnected);
      socket.off("connect_error", markDisconnected);
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  return { socket: socketRef, connected };
}
