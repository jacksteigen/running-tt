"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useSessionUser } from "@/components/SessionProvider";

const links = [
  { href: "/events", label: "Events" },
  { href: "/results", label: "Results" },
  { href: "/format", label: "Format" },
  { href: "/about", label: "About" },
];

export default function Nav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user } = useSessionUser();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-50 bg-midnight/90 backdrop-blur-md text-bone border-b border-bone/10">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/logo-nav.png"
            alt=""
            width={28}
            height={40}
            className="invert brightness-200"
            aria-hidden
          />
          <span className="t-eyebrow text-[0.95rem] tracking-[0.14em] text-bone">Running TT</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-[0.92rem] transition-colors ${
                pathname.startsWith(l.href)
                  ? "text-bone underline decoration-terracotta decoration-2 underline-offset-[10px]"
                  : "text-bone/65 hover:text-bone"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link href="/admin" className="text-[0.92rem] text-terracotta hover:text-bone transition-colors">
              Admin
            </Link>
          )}
          {user ? (
            <Link href="/dashboard" className="btn btn-sm btn-light ml-2">
              Your page
            </Link>
          ) : (
            <Link href="/login" className="btn btn-sm btn-primary ml-2">
              Sign in
            </Link>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          className="md:hidden text-stone/80 -mr-2 p-2"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          aria-controls="mobile-menu"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div id="mobile-menu" className="md:hidden border-t border-white/10 px-6 py-5 flex flex-col gap-4 bg-midnight/95">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="t-headline text-[1.6rem] text-bone/85 hover:text-bone">
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link href="/admin" className="text-base text-terracotta">
              Admin
            </Link>
          )}
          <Link href={user ? "/dashboard" : "/login"} className="btn btn-primary mt-2">
            {user ? "Your page" : "Sign in"}
          </Link>
        </div>
      )}
    </nav>
  );
}
