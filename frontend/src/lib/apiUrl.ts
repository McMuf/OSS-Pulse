// The backend's routes all live under /api (see backend/src/oss_pulse/api/main.py).
// NEXT_PUBLIC_API_URL is the origin to prepend:
//   - unset (local dev): falls back to http://localhost:8000
//   - standalone backend (e.g. Render): a full URL like https://oss-pulse-backend.onrender.com
//   - same-origin (Vercel Services rewrite): set to "" so this resolves to a relative "/api" path
export function getApiBase(): string {
  const origin = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return `${origin}/api`;
}
