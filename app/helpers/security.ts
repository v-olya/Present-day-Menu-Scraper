const WINDOW_MS = 60 * 1000; // 1 minute
const LIMIT = 5;

type Entry = number[]; // timestamps in ms

const store = new Map<string, Entry>();

export function enforceRateLimit(ip: string | null | undefined) {
  const key = ip || "unknown";
  const now = Date.now();
  const arr = store.get(key) ?? [];
  // Keep only timestamps within the window
  const cutoff = now - WINDOW_MS;
  const filtered = arr.filter((ts) => ts > cutoff);
  filtered.push(now);
  if (filtered.length > LIMIT) {
    // update store so stale timestamps are removed
    store.set(key, filtered);
    throw new Error("RATE_LIMIT_EXCEEDED");
  }
  store.set(key, filtered);
}

export function getClientIp(
  headers: Headers | Record<string, string> | unknown
): string | null {
  if (!headers) return null;

  const getHeader = (name: string): string | undefined => {
    // Headers-like
    if (typeof (headers as Headers).get === "function") {
      return (headers as Headers).get(name) ?? undefined;
    }
    const obj = headers as Record<string, unknown>;
    for (const k of Object.keys(obj || {})) {
      if (k.toLowerCase() === name.toLowerCase()) {
        const v = obj[k];
        return typeof v === "string" ? v : undefined;
      }
    }
    return undefined;
  };

  const xfwd = getHeader("x-forwarded-for");
  if (xfwd) return xfwd.split(",")[0].trim();
  const xreal = getHeader("x-real-ip");
  return xreal ? xreal.trim() : null;
}

// Test helper: clear in-memory store (not used in production)
export function _clearRateLimitStore() {
  store.clear();
}
