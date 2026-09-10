// The backend's routes all live under /api (see backend/src/oss_pulse/api/main.py).
//
// NEXT_PUBLIC_API_URL controls where to reach it:
//   - unset (local dev): falls back to http://localhost:8000
//   - standalone backend (e.g. Render): a full URL like https://oss-pulse-backend.onrender.com
//   - explicitly "" (same-origin, Vercel Services rewrite): see below
//
// The "" case needs care. A relative path like "/api" resolves fine in the
// browser (SearchModal's client-side fetch), but Next.js Server Components
// run fetch() in Node, where there's no "current page" to resolve a
// relative URL against - it throws, gets caught, and silently renders the
// "couldn't reach backend" fallback even though the backend is fine. So on
// the server we build an absolute URL from Vercel's own deployment domain
// (VERCEL_URL, a system env var - must be enabled under Project Settings ->
// Environment Variables -> "Enable access to System Environment Variables").
export function getApiBase(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;

  if (configured) {
    return `${configured}/api`;
  }

  if (configured === "") {
    if (typeof window === "undefined") {
      const vercelUrl = process.env.VERCEL_URL;
      if (vercelUrl) return `https://${vercelUrl}/api`;
    }
    return "/api";
  }

  return "http://localhost:8000/api";
}
