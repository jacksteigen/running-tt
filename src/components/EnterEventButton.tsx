"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

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
  const [declared, setDeclared] = useState(false);
  const [showDeclareNudge, setShowDeclareNudge] = useState(false);

  async function handleEnter() {
    if (!declared) {
      setShowDeclareNudge(true);
      return;
    }

    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, declared }),
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
    <div>
      {/* Clean sport declaration */}
      <label className="flex items-start gap-3 cursor-pointer select-none mb-4">
        <input
          type="checkbox"
          checked={declared}
          onChange={(e) => {
            setDeclared(e.target.checked);
            if (e.target.checked) setShowDeclareNudge(false);
          }}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#C4593A]"
        />
        <span className="text-xs text-midnight/70 leading-relaxed">
          {CLEAN_SPORT_DECLARATION}
        </span>
      </label>
      {showDeclareNudge && (
        <p className="text-xs text-terracotta mb-3">
          You need to make the declaration before you can enter.
        </p>
      )}

      <button
        onClick={handleEnter}
        disabled={loading}
        className={`w-full text-white text-sm font-medium py-3 transition-colors disabled:opacity-50 ${
          declared
            ? "bg-terracotta hover:bg-terracotta/90"
            : "bg-midnight/30 hover:bg-midnight/40"
        }`}
      >
        {loading ? "Processing..." : `Enter now${feeDisplay}`}
      </button>
    </div>
  );
}
