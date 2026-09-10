// The backend's routes all live under /api (see backend/src/oss_pulse/api/main.py).
//
// NEXT_PUBLIC_API_URL controls where to reach it:
//   - unset (local dev): falls back to http://localhost:8000
//   - standalone backend (e.g. Render): a full URL like https://oss-pulse-backend.onrender.com
//   - explicitly "" (same-origin, Vercel Services rewrite): resolved per context below
function configuredOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) return configured;
  if (configured === "") return null; // same-origin - resolve per context
  return "http://localhost:8000";
}

// For Client Components (the browser). A relative path resolves fine here,
// since the browser has a current page to resolve it against.
export function getApiBaseClient(): string {
  const origin = configuredOrigin();
  return origin === null ? "/api" : `${origin}/api`;
}

// For Server Components. A relative path does NOT work here - server-side
// fetch() has no "current page" to resolve against, and silently landing on
// the wrong URL (e.g. this Next.js app's own 404 page) surfaces as a
// confusing "<!DOCTYPE ... is not valid JSON" crash rather than a clean
// failure. We read the actual incoming request's Host header via
// next/headers instead of relying on Vercel's VERCEL_URL system env var,
// since that requires an opt-in dashboard setting ("Enable access to System
// Environment Variables") that's easy to forget or for a deploy to predate.
export async function getApiBaseServer(): Promise<string> {
  const origin = configuredOrigin();
  if (origin !== null) return `${origin}/api`;

  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}/api`;

  return "http://localhost:8000/api"; // safety net, shouldn't be reachable
}
