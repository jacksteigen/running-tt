/**
 * Normalise a user-supplied link. People type "www.strava.com/athletes/123"
 * far more often than they type a scheme, so a missing scheme is assumed to
 * be https rather than rejected. Anything that is not http or https after
 * normalising is refused.
 *
 * Returns the normalised URL, "" for an empty input (a cleared field), or
 * null when the value cannot be a usable web address.
 */
export function normaliseUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return "";

  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!url.hostname.includes(".")) return null;

  return url.toString();
}
