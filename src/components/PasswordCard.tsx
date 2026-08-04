"use client";

import { useState } from "react";

interface PasswordCardProps {
  hasPassword: boolean;
}

/**
 * Optional password sign-in. A password can only be set from inside a
 * signed-in session, so email ownership is always proven first.
 */
export default function PasswordCard({ hasPassword }: PasswordCardProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(hasPassword);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (data.success) {
        setSaved(true);
        setJustSaved(true);
        setOpen(false);
        setPassword("");
        setConfirm("");
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch {
      setError("Could not connect. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white border border-stone/40 p-6">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-dust mb-3">
        Account
      </p>
      <h3 className="font-semibold tracking-tight mb-2">Password</h3>

      {!open ? (
        <>
          <p className="text-xs text-midnight/50 leading-relaxed mb-4">
            {saved
              ? "Password sign-in is on. You can sign in with your email and password on any device."
              : "Optional. Set a password so you can sign in without waiting for an email link."}
          </p>
          <div aria-live="polite">
            {justSaved && (
              <p className="text-xs text-trail mb-3">Password saved.</p>
            )}
          </div>
          <button
            onClick={() => {
              setOpen(true);
              setJustSaved(false);
            }}
            className="text-xs font-medium text-terracotta border border-terracotta/30 px-3 py-1.5 hover:bg-terracotta/5 transition-colors"
          >
            {saved ? "Change password" : "Set a password"}
          </button>
        </>
      ) : (
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label
              htmlFor="new-password"
              className="block text-xs font-medium mb-1.5"
            >
              New password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-xs font-medium mb-1.5"
            >
              Confirm password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              minLength={8}
              required
              className="w-full border border-stone/40 px-3 py-2 text-sm bg-bone/50 focus:outline-none focus:border-terracotta transition-colors"
            />
          </div>
          <p className="text-[11px] text-dust leading-relaxed">
            At least 8 characters. Email links keep working either way.
          </p>
          {error && (
            <p role="alert" className="text-xs text-terracotta">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-terracotta text-white text-xs font-medium py-2 hover:bg-terracotta/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="px-3 text-xs text-midnight/60 hover:text-midnight transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
