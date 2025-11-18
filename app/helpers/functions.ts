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
