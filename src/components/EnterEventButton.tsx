"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
        <div className="w-full bg-trail/10 text-trail text-sm font-medium py-3.5 text-center">
          You are entered
        </div>
        {eventSlug && (
          <Link
            href={`/events/${eventSlug}/booked`}
            className="mt-1 block py-2.5 text-center text-xs font-medium text-midnight/60 underline underline-offset-2 hover:text-terracotta transition-colors"
          >
            View your ticket
          </Link>
        )}
      </div>
    );
  }

  if (eventStatus !== "Open") {
    return (
      <button
        disabled
        className="w-full bg-midnight/20 text-white text-sm font-medium py-3.5 cursor-not-allowed"
      >
        {eventStatus === "Coming Soon" ? "Entries opening soon" : eventStatus}
      </button>
    );
  }

  const feeDisplay =
    entryFeeCents > 0 ? ` · $${(entryFeeCents / 100).toFixed(0)}` : " · Free";

  if (!isLoggedIn) {
    return (
      <Link
        href={loginHref}
        className="block w-full bg-terracotta text-white text-sm font-medium py-3.5 text-center hover:bg-terracotta/90 transition-colors"
      >
        Sign in to enter{feeDisplay}
      </Link>
    );
  }

  if (!profileCompleted) {
    return (
      <Link
        href={welcomeHref}
        className="block w-full bg-terracotta text-white text-sm font-medium py-3.5 text-center hover:bg-terracotta/90 transition-colors"
      >
        Set up your profile to enter
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={handleEnter}
        disabled={loading}
        className="w-full bg-terracotta text-white text-sm font-medium py-3.5 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
      >
        {loading ? "Entering..." : `Enter now${feeDisplay}`}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-xs text-terracotta">
          {error}
        </p>
      )}
    </div>
  );
}
