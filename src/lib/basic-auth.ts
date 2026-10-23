// Optional shared-password gate for a public demo (HTTP Basic authentication). Set DEMO_BASIC_AUTH="user:password"
// and every page and API route asks the browser for it, before the app's own (password-less) login.
// Dependency-free so the proxy can use it.

/** Compares two strings in time that depends only on their length, not on where they first differ. */
export function safeEqual(a: string, b: string): boolean {
  const length = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < length; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** True if the Authorization header carries exactly the expected "user:password". */
export function isAuthorized(authorizationHeader: string | null, expected: string): boolean {
  if (!authorizationHeader || !authorizationHeader.toLowerCase().startsWith("basic ")) return false;
  let decoded: string;
  try {
    const bytes = Uint8Array.from(atob(authorizationHeader.slice(6).trim()), (c) => c.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch {
    return false;
  }
  return safeEqual(decoded, expected);
}

/** Paths that must stay open so the host can check that the app is alive. */
export const isHealthCheck = (pathname: string) => pathname === "/api/health";
