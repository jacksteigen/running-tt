"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DeclarationBox from "@/components/DeclarationBox";

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
      <div className="mb-4">
        <DeclarationBox
          declared={declared}
          onDeclaredChange={(value) => {
            setDeclared(value);
            if (value) setShowDeclareNudge(false);
          }}
          maxHeightClass="max-h-36"
        />
      </div>
      {showDeclareNudge && (
        <p className="text-xs text-terracotta mb-3">
          You need to sign the declaration before you can enter.
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
