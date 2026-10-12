"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 3000;
const MAX_TRIES = 20;

/**
 * Shown for the few seconds between Stripe taking the payment and the
 * booking being confirmed. Re-checks quietly, then offers a way out if the
 * bank is slow.
 */
export default function PaymentPending({ eventHref }: { eventHref: string }) {
  const router = useRouter();
  const [tries, setTries] = useState(0);
  const waiting = tries < MAX_TRIES;

  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => {
      router.refresh();
      setTries((t) => t + 1);
    }, INTERVAL_MS);
    return () => clearTimeout(id);
  }, [router, tries, waiting]);

  return (
    <div className="bg-white border border-stone/40 p-7 md:p-10 motion-safe:animate-fade-up">
      <div aria-hidden className="h-0.5 bg-stone/50 overflow-hidden mb-8">
        <div
          className={`h-full bg-terracotta origin-left ${
            waiting ? "w-1/3 motion-safe:animate-pulse" : "w-full bg-dust"
          }`}
        />
      </div>

      <div aria-live="polite">
        {waiting ? (
          <>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-terracotta mb-3">
              Payment received
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              Confirming your payment
            </h1>
            <p className="mt-3 text-midnight/60 leading-relaxed max-w-lg">
              This usually takes a few seconds. Stay on this page and your ticket
              will appear here.
            </p>
          </>
        ) : (
          <>
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-dust mb-3">
              Still confirming
            </p>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
              This is taking longer than usual
            </h1>
            <p className="mt-3 text-midnight/60 leading-relaxed max-w-lg">
              Your spot is held while the payment clears. We will email your
              confirmation the moment it lands, and your ticket will be here.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => setTries(0)}
                className="bg-terracotta text-white text-sm font-medium px-6 py-3.5 min-h-12 hover:bg-terracotta/90 transition-colors"
              >
                Check again
              </button>
              <Link
                href={eventHref}
                className="inline-flex items-center justify-center border border-midnight/20 text-sm font-medium px-6 py-3.5 min-h-12 hover:border-midnight/50 transition-colors"
              >
                Back to the event
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
