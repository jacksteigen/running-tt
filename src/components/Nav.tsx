"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ name: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json() as Promise<{ user: { name: string } | null }>)
      .then((data) => setUser(data.user))
      .catch(() => {});
  }, []);

  return (
    <nav className="bg-midnight text-white">
      <div className="mx-auto max-w-6xl px-6 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-nav.png"
            alt="Running TT"
            width={28}
            height={40}
            className="invert brightness-200"
          />
          <span className="text-lg font-semibold tracking-tight">
            RUNNING TT
          </span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            href="/events"
            className="text-sm text-stone/80 hover:text-white transition-colors"
          >
            Events
          </Link>
          <Link
            href="/results"
            className="text-sm text-stone/80 hover:text-white transition-colors"
          >
            Results
          </Link>
          <Link
            href="/about"
            className="text-sm text-stone/80 hover:text-white transition-colors"
          >
            About
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="ml-4 bg-terracotta text-white text-sm font-medium px-5 py-2 hover:bg-terracotta/90 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="ml-4 bg-terracotta text-white text-sm font-medium px-5 py-2 hover:bg-terracotta/90 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-stone/80 -mr-2 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            {menuOpen ? (
              <path d="M6 6l12 12M6 18L18 6" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/10 px-6 py-4 flex flex-col gap-4">
          <Link
            href="/events"
            className="text-sm text-stone/80 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            Events
          </Link>
          <Link
            href="/results"
            className="text-sm text-stone/80 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            Results
          </Link>
          <Link
            href="/about"
            className="text-sm text-stone/80 hover:text-white"
            onClick={() => setMenuOpen(false)}
          >
            About
          </Link>
          {user ? (
            <Link
              href="/dashboard"
              className="bg-terracotta text-white text-sm font-medium px-5 py-2 text-center hover:bg-terracotta/90"
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="bg-terracotta text-white text-sm font-medium px-5 py-2 text-center hover:bg-terracotta/90"
              onClick={() => setMenuOpen(false)}
            >
              Sign in
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
