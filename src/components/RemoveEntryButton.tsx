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
  const [error, setError] = useState("");

  async function remove() {
    if (!window.confirm(`Remove this entry for ${label}?`)) return;
    try {
      const res = await fetch(`/api/admin/entries/${entryId}`, { method: "DELETE" });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) router.refresh();
      else setError(data.error || "Could not remove");
    } catch {
      setError("Could not connect");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={remove}
        disabled={disabled}
        title={disabled ? "Clear their time first" : "Remove entry"}
        className="text-xs text-dust hover:text-terracotta transition-colors disabled:opacity-30"
      >
        Remove
      </button>
      {error && <span className="text-xs text-terracotta">{error}</span>}
    </span>
  );
}
