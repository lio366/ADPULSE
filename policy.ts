/** Security policy primitives. Production rate limiting must use a shared Redis store. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SECURITY_LIMITS = {
  auth: { windowMs: 15 * 60_000, max: 10 },
  api: { windowMs: 60_000, max: 120 },
} as const;

export function isUnsafeMethod(method: string): boolean {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

export function originAllowed(origin: string | null, expectedOrigin: string): boolean {
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(expectedOrigin).origin; }
  catch { return false; }
}

export function buildSecurityHeaders(nonce: string) {
  return {
    "Content-Security-Policy": [
      "default-src 'self'",
      `script-src 'self' 'nonce-${nonce}'`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https:",
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
}
