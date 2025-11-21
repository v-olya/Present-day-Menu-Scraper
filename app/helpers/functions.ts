import { MenuItem } from "./types";

export const isDateToday = (date: string): boolean => {
  const d = new Date(date);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
};

export const formatDate = (date: string): string => {
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  };
  const capitalize = (str: string): string =>
    str.charAt(0).toUpperCase() + str.slice(1);
  return capitalize(new Date(date).toLocaleDateString("cs-CZ", options));
};

export const normalizeUrl = (url: string) => {
  // Normalize URL for stable cache keys: lowercase host, remove trailing slashes
  try {
    const trimmed = url.trim();
    // If it's not an absolute URL, just trim/remove trailing slash
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return trimmed.replace(/\/+$/g, "");
    }
    const host = parsed.host.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/g, "");
    const search = parsed.search || "";
    // Preserve the original protocol
    return `${parsed.protocol}//${host}${pathname}${search}`;
  } catch {
    return url;
  }
};

export function applyDelay(
  attempt: number,
  delayMS: number,
  signal?: AbortSignal
) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Aborted"));

    const ms = delayMS * Math.pow(2, attempt);
    const t = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(t);
      reject(new Error("Aborted"));
    }
    signal?.addEventListener("abort", onAbort);
  });
}

export async function retryFetch(
  url: string,
  init: RequestInit,
  retries = 3,
  delay = 300
): Promise<Response> {
  let lastErr: unknown = null;
  const signal = init?.signal as AbortSignal | undefined;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      const res = await fetch(url, init);
      // On server errors:
      if (res.status >= 500 && attempt < retries - 1) {
        await applyDelay(attempt, delay, signal);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (signal?.aborted || attempt === retries - 1) break;
      // On network errors
      await applyDelay(attempt, delay, signal);
    }
  }
  throw lastErr ?? new Error("retryFetch() failed");
}

// For openai-call only
export async function retryAsync<T>(
  fn: () => Promise<T>,
  shouldRetry: (err: unknown) => boolean | Promise<boolean>,
  signal?: AbortSignal,
  retries = 2,
  delay = 600
): Promise<T> {
  const shouldRetryFn = shouldRetry ?? isNetworkError;

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) throw new Error("Aborted");
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const allowed = await Promise.resolve(shouldRetryFn(err));
      const lastAttempt = attempt === retries - 1;
      if (!allowed || lastAttempt || (signal && signal.aborted)) break;
      await applyDelay(attempt, delay, signal);
    }
  }
  throw lastErr ?? new Error("retryAsync failed");
}

/* Helper predicate when you want to retry only on network/transient errors. */
export function isNetworkError(err: unknown): boolean {
  const obj = err as Record<string, unknown> | undefined;
  if (!obj) return false;
  // Common transient network error codes
  const code = obj["code"];
  const transientCodes = ["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "ENOTFOUND"];
  if (typeof code === "string" && transientCodes.includes(code)) return true;
  const msg = String(obj["message"] ?? "").toLowerCase();
  // Simple substring checks for network-like failures / timeouts
  if (
    msg.includes("timeout") ||
    msg.includes("network") ||
    msg.includes("failed to fetch")
  )
    return true;
  return false;
}

export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  signal?: AbortSignal
): Promise<T> {
  if (signal?.aborted) throw new Error("Aborted");

  const timeoutPromise = new Promise<T>((_, rej) => {
    const timer = setTimeout(() => rej(new Error("Timed out")), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      rej(new Error("Aborted"));
    });
  });

  return Promise.race([p, timeoutPromise]) as Promise<T>;
}

export const getPrettyParsed = (
  raw: string,
  json: Record<string, unknown> | null
): string => {
  if (!raw) return "";
  let prettyParsed: string | null = raw;
  const parsedJson = json;
  // Exclude the rationale from the LLM output
  const withoutRationale = { ...parsedJson };
  delete (withoutRationale as Record<string, unknown>).rationale;
  try {
    prettyParsed = JSON.stringify(withoutRationale, null, 2);
  } catch {}
  return prettyParsed;
};

// Group menu items by dish category
export const groupDishes = (menu_items: MenuItem[]) =>
  menu_items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = [];
    }
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);
