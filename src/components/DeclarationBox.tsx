"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Dancing_Script } from "next/font/google";
import { CLEAN_SPORT_DECLARATION } from "@/lib/declaration";

const script = Dancing_Script({
  subsets: ["latin"],
  weight: "700",
});

interface DeclarationBoxProps {
  declared: boolean;
  onDeclaredChange: (declared: boolean) => void;
  /** Height of the scrollable document area. Defaults to a compact size. */
  maxHeightClass?: string;
}

/**
 * The clean-sport declaration presented as a formal document. The athlete
 * must scroll to the end of the document before the sign checkbox unlocks,
 * the same pattern as contract acceptance flows.
 */
export default function DeclarationBox({
  declared,
  onDeclaredChange,
  maxHeightClass = "max-h-52",
}: DeclarationBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);
  const hintId = useId();

  function checkScrolledToEnd(el: HTMLDivElement) {
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 8) {
      setReadToEnd(true);
    }
  }

  // If the document happens to fit without scrolling, unlock immediately.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && el.scrollHeight <= el.clientHeight + 2) {
      setReadToEnd(true);
    }
  }, []);

  return (
    <div>
      {/* Document, set like a certificate on paper */}
      <div className="border border-midnight/15 bg-white">
        {/* Header */}
        <div className="px-6 pt-7 pb-5 text-center border-b rule">
          <p
            className={`${script.className} text-[2.6rem] md:text-5xl text-midnight leading-none`}
          >
            Declaration
          </p>
          <div aria-hidden className="mx-auto mt-4 h-px w-12 bg-terracotta" />
          <p className="t-eyebrow text-dust mt-3">Running TT · Clean sport</p>
        </div>

        {/* Scrollable body. Focusable so it can be read with the keyboard. */}
        <div
          ref={scrollRef}
          onScroll={(e) => checkScrolledToEnd(e.currentTarget)}
          tabIndex={0}
          role="region"
          aria-label="Clean sport declaration"
          className={`${maxHeightClass} overflow-y-auto px-6 py-5 space-y-4 font-serif`}
        >
          <p className="text-[1.08rem] leading-[1.5] italic text-midnight">
            &ldquo;{CLEAN_SPORT_DECLARATION}&rdquo;
          </p>

          <p className="text-[0.95rem] leading-relaxed text-midnight/70">
            I make this declaration freely, before my God, my family, my
            friends, and every athlete who lines up beside me.
          </p>
          <p className="text-[0.95rem] leading-relaxed text-midnight/70">
            I understand that every time, every placing, and every dollar of
            prize money at Running TT is earned. Racing clean is the whole
            point.
          </p>
          <p className="text-[0.95rem] leading-relaxed text-midnight/70">
            I understand that breaching this declaration means removal of my
            results, forfeiture of any prize money, and exclusion from future
            Running TT events.
          </p>
          <p className="text-[0.95rem] leading-relaxed text-midnight/70">
            This declaration is recorded against my account and covers every
            event I enter.
          </p>

          <div className="pt-4 mt-2 border-t rule">
            <p className="t-eyebrow text-dust">Signed by ticking the box below</p>
          </div>
        </div>
      </div>

      {/* Scroll hint, then the sign row */}
      {!readToEnd && (
        <p id={hintId} className="t-caption mt-3 text-terracotta">
          Read to the end of the declaration to sign it.
        </p>
      )}

      <label
        className={`flex items-start gap-3 select-none mt-2 py-2 min-h-11 ${
          readToEnd ? "cursor-pointer" : "cursor-not-allowed opacity-50"
        }`}
      >
        <input
          type="checkbox"
          checked={declared}
          disabled={!readToEnd}
          aria-describedby={readToEnd ? undefined : hintId}
          onChange={(e) => onDeclaredChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-[#C4593A]"
        />
        <span className="text-[0.95rem] text-midnight/80 leading-snug">
          I have read the declaration and I sign it.
        </span>
      </label>
    </div>
  );
}
