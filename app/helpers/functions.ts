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

export const getDomainName = (host: string) => {
  // non-reliable extractor: we need domain name as a fallback for the restaurant_name
  return host
    .replace(/^www\./, "")
    .split(".")
    .slice(0, -1)
    .join(".");
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
