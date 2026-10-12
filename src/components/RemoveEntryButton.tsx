"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RemoveEntryButton({
  entryId,
  label,
  disabled,
}: {
  entryId: string;
  label: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(confirmPaid = false) {
    if (!confirmPaid && !window.confirm(`Remove this entry for ${label}?`)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/entries/${entryId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPaid }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        code?: string;
      };
      if (data.success) {
        router.refresh();
      } else if (res.status === 409 && data.code === "PAID") {
        // They paid online. Removing them needs a second, deliberate yes.
        router.refresh();
        if (
          !confirmPaid &&
          window.confirm(`${data.error || "This athlete paid online."} Remove them anyway?`)
        ) {
          setBusy(false);
          await remove(true);
          return;
        }
        setError(data.error || "They paid online, so they are still entered.");
      } else {
        setError(
          data.error ||
            (res.status === 502
              ? "Could not reach Stripe to close their checkout. Try again in a minute."
              : "Could not remove")
        );
      }
    } catch {
      setError("Could not connect");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => remove()}
        disabled={disabled || busy}
        title={disabled ? "Clear their time first" : "Remove entry"}
        className="min-h-11 px-2 -mx-2 inline-flex items-center text-xs text-dust hover:text-terracotta transition-colors disabled:opacity-30"
      >
        {busy ? "Removing..." : "Remove"}
      </button>
      {error && (
        <span role="alert" className="max-w-[12rem] sm:max-w-xs text-xs text-terracotta leading-snug">
          {error}
        </span>
      )}
    </span>
  );
}
