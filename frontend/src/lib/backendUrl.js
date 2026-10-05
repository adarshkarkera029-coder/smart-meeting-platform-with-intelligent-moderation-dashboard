/**
 * Where REST + Socket.io should talk.
 *
 * Dev: same origin so Vite can proxy /api and /socket.io. That avoids CORS,
 * cookie credential failures, and the classic "page is 192.168.x.x but env
 * says localhost" reconnect loop.
 *
 * Prod: VITE_BACKEND_URL (Railway / Render / etc.).
 */
export function resolveBackendUrl() {
  const envUrl = String(import.meta.env.VITE_BACKEND_URL || "").trim().replace(/\/$/, "");

  if (import.meta.env.DEV) {
    if (typeof window === "undefined") return envUrl || "http://localhost:4000";
    return window.location.origin;
  }

  if (envUrl) {
    if (typeof window !== "undefined") {
      try {
        const parsed = new URL(envUrl);
        const pageHost = window.location.hostname;
        const loopback = (h) => h === "localhost" || h === "127.0.0.1";
        if (loopback(parsed.hostname) && !loopback(pageHost)) {
          parsed.hostname = pageHost;
          return parsed.origin;
        }
      } catch {
        /* use env as-is */
      }
    }
    return envUrl;
  }

  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:4000";
}

export function apiUrl(path) {
  const base = resolveBackendUrl().replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}
