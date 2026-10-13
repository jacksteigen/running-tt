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
    <div className="motion-safe:animate-fade-up">
      <div aria-hidden className="h-[2px] bg-midnight/10 overflow-hidden mb-10">
        <div
          className={`h-full origin-left ${
            waiting ? "w-1/3 bg-terracotta motion-safe:animate-pulse" : "w-full bg-dust"
          }`}
        />
      </div>

      <div aria-live="polite">
        {waiting ? (
          <>
            <p className="t-eyebrow text-terracotta">Payment received</p>
            <h1 className="t-display mt-4 text-[2.5rem] md:text-[3.6rem]">
              Confirming your <em>payment</em>
            </h1>
            <p className="mt-5 text-[1.05rem] text-midnight/65 leading-relaxed max-w-lg">
              This usually takes a few seconds. Stay on this page and your ticket
              will appear here.
            </p>
          </>
        ) : (
          <>
            <p className="t-eyebrow text-dust">Still confirming</p>
            <h1 className="t-display mt-4 text-[2.5rem] md:text-[3.6rem]">
              This is taking <em>longer than usual</em>
            </h1>
            <p className="mt-5 text-[1.05rem] text-midnight/65 leading-relaxed max-w-lg">
              Your spot is held while the payment clears. We will email your
              confirmation the moment it lands, and your ticket will be here.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <button type="button" onClick={() => setTries(0)} className="btn btn-primary">
                Check again
              </button>
              <Link
                href={eventHref}
                className="inline-flex min-h-11 items-center justify-center text-[0.95rem] text-midnight"
              >
                <span className="link-quiet">Back to the event</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
