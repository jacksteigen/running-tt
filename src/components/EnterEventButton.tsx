"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface EnterEventButtonProps {
  eventId: string;
  eventStatus: string;
  entryFeeCents: number;
  isLoggedIn: boolean;
  profileCompleted: boolean;
  alreadyEntered: boolean;
}

export default function EnterEventButton({
  eventId,
  eventStatus,
  entryFeeCents,
  isLoggedIn,
  profileCompleted,
  alreadyEntered,
}: EnterEventButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        next?: string;
      };

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        router.refresh();
      } else if (data.next) {
        router.push(data.next);
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
      <div className="w-full bg-trail/10 text-trail text-sm font-medium py-3.5 text-center">
        You are entered
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
        href="/login"
        className="block w-full bg-terracotta text-white text-sm font-medium py-3.5 text-center hover:bg-terracotta/90 transition-colors"
      >
        Sign in to enter{feeDisplay}
      </Link>
    );
  }

  if (!profileCompleted) {
    return (
      <Link
        href="/welcome"
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
