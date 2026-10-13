"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatFee } from "@/lib/money";

interface EnterEventButtonProps {
  eventId: string;
  /** Lets sign-in and onboarding bring the athlete back to this event. */
  eventSlug?: string;
  eventStatus: string;
  entryFeeCents: number;
  isLoggedIn: boolean;
  profileCompleted: boolean;
  alreadyEntered: boolean;
}

/**
 * One-tap entry for events without heats. Events with heats go through the
 * heat booking page instead.
 */
export default function EnterEventButton({
  eventId,
  eventSlug,
  eventStatus,
  entryFeeCents,
  isLoggedIn,
  profileCompleted,
  alreadyEntered,
}: EnterEventButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const eventPath = eventSlug ? `/events/${eventSlug}` : "";
  const loginHref = eventPath ? `/login?next=${encodeURIComponent(eventPath)}` : "/login";
  const welcomeHref = eventPath ? `/welcome?next=${encodeURIComponent(eventPath)}` : "/welcome";

  async function handleEnter() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      const data = (await res.json()) as {
        checkoutUrl?: string;
        success?: boolean;
        error?: string;
        code?: string;
        next?: string;
      };

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        if (data.next) router.push(data.next);
        else router.refresh();
      } else if (data.code === "PROFILE" && data.next) {
        router.push(
          eventPath && !data.next.includes("?")
            ? `${data.next}?next=${encodeURIComponent(eventPath)}`
            : data.next
        );
      } else if (data.code === "AUTH") {
        router.push(loginHref);
      } else if (data.code === "ALREADY_BOOKED" && eventSlug) {
        // Already entered, or the payment from an earlier checkout went through.
        router.push(`/events/${eventSlug}/booked`);
      } else if (data.code === "CATEGORY_REQUIRED") {
        // The race now pays by category: the page redraws with the question.
        setError(data.error || "Pick the category you race in before you enter.");
        router.refresh();
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (alreadyEntered) {
    return (
      <div>
        <p className="t-eyebrow text-trail inline-flex items-center gap-2">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-trail" />
          You are in
        </p>
        {eventSlug && (
          <Link href={`/events/${eventSlug}/booked`} className="btn btn-ghost mt-4">
            View your booking
          </Link>
        )}
      </div>
    );
  }

  if (eventStatus !== "Open") {
    return (
      <button type="button" disabled className="btn btn-ghost w-full">
        {eventStatus === "Coming Soon" ? "Entries opening soon" : eventStatus}
      </button>
    );
  }

  const feeDisplay = entryFeeCents > 0 ? ` · ${formatFee(entryFeeCents)}` : " · Free";

  if (!isLoggedIn) {
    return (
      <Link href={loginHref} className="btn btn-primary w-full">
        Sign in to enter{feeDisplay}
      </Link>
    );
  }

  if (!profileCompleted) {
    return (
      <Link href={welcomeHref} className="btn btn-primary w-full">
        Set up your profile to enter
      </Link>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleEnter}
        disabled={loading}
        aria-busy={loading}
        className="btn btn-primary w-full"
        style={loading ? { opacity: 0.85, cursor: "wait" } : undefined}
      >
        {loading ? "Entering..." : `Enter now${feeDisplay}`}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-[0.85rem] text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
