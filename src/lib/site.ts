/** Canonical public origin. Links in emails and Stripe redirects always use
 * this, never the request host, so a workers.dev hostname never leaks out. */
export const SITE_URL = "https://runningtt.com";

/**
 * Accept only same-site relative paths for post-sign-in redirects, so a
 * crafted link cannot bounce someone to another site.
 */
export function safeNextPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (!/^\/[A-Za-z0-9\-._~/?=&%]*$/.test(value)) return null;
  if (value.startsWith("/api/") || value.startsWith("/login")) return null;
  return value;
}
