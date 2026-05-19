"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface EnterEventButtonProps {
  eventId: string;
  eventStatus: string;
  entryFeeCents: number;
  isLoggedIn: boolean;
  alreadyEntered: boolean;
}

export default function EnterEventButton({
  eventId,
  eventStatus,
  entryFeeCents,
  isLoggedIn,
  alreadyEntered,
}: EnterEventButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleEnter() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId }),
      });

      const data = (await res.json()) as { checkoutUrl?: string; success?: boolean; error?: string };

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.success) {
        router.refresh();
      } else {
        alert(data.error || "Something went wrong");
      }
    } catch {
      alert("Could not connect. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (alreadyEntered) {
    return (
      <div className="w-full bg-trail/10 text-trail text-sm font-medium py-3 text-center">
        You are entered
      </div>
    );
  }

  if (eventStatus !== "Open") {
    return (
      <button
        disabled
        className="w-full bg-midnight/20 text-white text-sm font-medium py-3 cursor-not-allowed"
      >
        {eventStatus === "Coming Soon"
          ? "Entries opening soon"
          : eventStatus}
      </button>
    );
  }

  const feeDisplay =
    entryFeeCents > 0 ? ` · $${(entryFeeCents / 100).toFixed(0)}` : "";

  return (
    <button
      onClick={handleEnter}
      disabled={loading}
      className="w-full bg-terracotta text-white text-sm font-medium py-3 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
    >
      {loading ? "Processing..." : `Enter now${feeDisplay}`}
    </button>
  );
}
