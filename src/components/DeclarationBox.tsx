"use client";

import { useEffect, useRef, useState } from "react";
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
  maxHeightClass = "max-h-44",
}: DeclarationBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readToEnd, setReadToEnd] = useState(false);

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
      {/* Document */}
      <div className="border border-stone/60 bg-white">
        {/* Header */}
        <div className="relative overflow-hidden bg-midnight px-5 pt-6 pb-5 text-center">
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 39px, #F5F2EC 39px 40px)",
            }}
          />
          <div className="relative">
            <p
              className={`${script.className} text-4xl md:text-5xl text-bone leading-none`}
            >
              Declaration
            </p>
            <div className="mx-auto mt-4 h-px w-16 bg-terracotta" />
            <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-stone/50 mt-3">
              Running TT · Clean sport
            </p>
          </div>
        </div>

        {/* Scrollable body */}
        <div
          ref={scrollRef}
          onScroll={(e) => checkScrolledToEnd(e.currentTarget)}
          className={`${maxHeightClass} overflow-y-auto px-5 py-4 space-y-4`}
        >
          <p className="text-sm text-midnight/80 leading-relaxed italic">
            &ldquo;{CLEAN_SPORT_DECLARATION}&rdquo;
          </p>

          <p className="text-xs text-midnight/60 leading-relaxed">
            I make this declaration freely, before my God, my family, my
            friends, and every athlete who lines up beside me.
          </p>
          <p className="text-xs text-midnight/60 leading-relaxed">
            I understand that every time, every placing, and every dollar of
            prize money at Running TT is earned. Racing clean is the whole
            point.
          </p>
          <p className="text-xs text-midnight/60 leading-relaxed">
            I understand that breaching this declaration means removal of my
            results, forfeiture of any prize money, and exclusion from future
            Running TT events.
          </p>
          <p className="text-xs text-midnight/60 leading-relaxed">
            This declaration is recorded against my account, and again with
            every event I enter.
          </p>

          <div className="pt-2 border-t border-stone/40">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-dust">
              Signed by ticking the box below
            </p>
          </div>
        </div>
      </div>

      {/* Scroll hint / sign row */}
      {!readToEnd && (
        <p className="mt-2 text-[11px] text-terracotta flex items-center gap-1.5">
          <span aria-hidden>↓</span> Read to the end of the declaration to
          sign it
        </p>
      )}

      <label
        className={`flex items-start gap-3 select-none mt-3 ${
          readToEnd ? "cursor-pointer" : "cursor-not-allowed opacity-50"
        }`}
      >
        <input
          type="checkbox"
          checked={declared}
          disabled={!readToEnd}
          onChange={(e) => onDeclaredChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 accent-[#C4593A]"
        />
        <span className="text-xs text-midnight/70 leading-relaxed">
          I have read the declaration and I sign it.
        </span>
      </label>
    </div>
  );
}
