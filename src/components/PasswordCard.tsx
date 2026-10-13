"use client";

import { useState } from "react";
import { fieldInputCls } from "@/components/fieldStyles";

const inputCls = fieldInputCls;

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
    <div className="bg-white border rule p-6 md:p-8">
      <h3 className="t-headline text-[1.5rem]">Password</h3>

      {!open ? (
        <>
          <p className="mt-3 text-[0.95rem] text-midnight/65 leading-relaxed">
            {saved
              ? "Password sign-in is on. You can sign in with your email and password on any device."
              : "Optional. Set a password so you can sign in without waiting for an email link."}
          </p>
          <div aria-live="polite">
            {justSaved && (
              <p className="mt-3 text-[0.9rem] text-trail">Password saved.</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setJustSaved(false);
            }}
            className="btn btn-sm btn-ghost mt-5"
          >
            {saved ? "Change password" : "Set a password"}
          </button>
        </>
      ) : (
        <form onSubmit={handleSave} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="new-password"
              className="block text-[0.85rem] text-midnight/70 mb-2"
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
              className={inputCls}
            />
          </div>
          <div>
            <label
              htmlFor="confirm-password"
              className="block text-[0.85rem] text-midnight/70 mb-2"
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
              className={inputCls}
            />
          </div>
          <p className="t-caption text-midnight/55">
            At least 8 characters. Email links keep working either way.
          </p>
          {error && (
            <p role="alert" className="text-[0.9rem] text-terracotta">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1">
            <button type="submit" disabled={saving} className="btn btn-sm btn-ink">
              {saving ? "Saving..." : "Save password"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="link-quiet min-h-11 text-[0.9rem] text-midnight/70 hover:text-midnight transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
