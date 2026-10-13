import type { Metadata } from "next";
import { purseCents, toPrizeSplit } from "@/lib/categories";
import { formatEventDate, isDateTbc } from "@/lib/dates";
import { displayStatus } from "@/lib/events";
import { hasHeats } from "@/lib/heats";
import { formatFee } from "@/lib/money";
import { parsePrizes } from "@/lib/racetime";

/** Canonical public origin. Links in emails and Stripe redirects always use
 * this, never the request host, so a workers.dev hostname never leaks out. */
export const SITE_URL = "https://runningtt.com";

/**
 * The link preview card for iMessage, Messenger, WhatsApp and the rest:
 * 1200x630, kept under 300 KB so WhatsApp will show it. Give it a new file
 * name when the design changes, so apps that cache previews fetch it again.
 */
export const SHARE_IMAGE = {
  url: "/images/share-card.jpg",
  width: 1200,
  height: 630,
  alt: "Running TT. You. The clock. Nothing else.",
};

/** What a race's link preview is built from. */
export interface ShareableEvent {
  slug: string;
  name: string;
  distance: string;
  date: string;
  venue: string;
  location: string;
  status: string;
  prizes: string | null;
  prize_split: string | null;
  heat_count: number | null;
}

/**
 * The link preview for a race, shared by its event page and its booking
 * page so both read the same: the race and its purse, then where and when,
 * then what to do next, under the site share card. A child page's openGraph
 * replaces the root one whole, so this carries every field.
 */
export function eventShareMetadata(event: ShareableEvent): Pick<Metadata, "openGraph" | "twitter"> {
  const purse = purseCents(parsePrizes(event.prizes), toPrizeSplit(event.prize_split));
  const place = [event.venue, event.location].filter((v) => v && !/TBC/i.test(v)).join(", ");
  const tbc = isDateTbc(event.date);
  const status = tbc ? event.status : displayStatus(event.status, event.date);
  const finished = status === "Completed";

  const title = [event.name, purse > 0 ? `${formatFee(purse)} prize purse` : null]
    .filter(Boolean)
    .join(" · ");
  const when = tbc
    ? "Date to be announced."
    : `${finished ? "Raced " : ""}${formatEventDate(event.date, "long")}.`;
  const next = finished
    ? "Results on Running TT."
    : status === "Coming Soon"
      ? "Bookings open soon on Running TT."
      : status === "Sold Out"
        ? "Sold out. Follow the race on Running TT."
        : hasHeats(event)
          ? "Book your heat on Running TT."
          : "Enter on Running TT.";
  const description = [
    place ? `${event.distance} time trial at ${place}.` : `${event.distance} time trial.`,
    when,
    next,
  ].join(" ");

  return {
    openGraph: {
      type: "website",
      siteName: "Running TT",
      locale: "en_AU",
      url: `${SITE_URL}/events/${event.slug}`,
      title,
      description,
      images: [SHARE_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [SHARE_IMAGE.url],
    },
  };
}

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
