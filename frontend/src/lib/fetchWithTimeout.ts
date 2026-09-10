// Render's free tier can take up to ~60s to wake a sleeping backend from
// cold. This timeout is set above that so a cold start still succeeds, but
// a genuinely unreachable backend fails within a bounded time instead of
// hanging the page load indefinitely.
const DEFAULT_TIMEOUT_MS = 65_000;

export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
