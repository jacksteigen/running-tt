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
    <nav className="sticky top-0 z-50 bg-midnight/85 backdrop-blur-md text-white border-b border-white/5">
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
          <span className="text-lg font-semibold tracking-tight">RUNNING TT</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`text-sm transition-colors ${
                pathname.startsWith(l.href) ? "text-white" : "text-stone/70 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link href="/admin" className="text-sm text-terracotta hover:text-terracotta/80 transition-colors">
              Admin
            </Link>
          )}
          {user ? (
            <Link
              href="/dashboard"
              className="ml-2 bg-terracotta text-white text-sm font-medium px-5 py-2 hover:bg-terracotta/90 transition-colors"
            >
              Dashboard
            </Link>
          ) : (
            <Link
              href="/login"
              className="ml-2 bg-terracotta text-white text-sm font-medium px-5 py-2 hover:bg-terracotta/90 transition-colors"
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
            <Link key={l.href} href={l.href} className="text-base text-stone/80 hover:text-white">
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link href="/admin" className="text-base text-terracotta">
              Admin
            </Link>
          )}
          <Link
            href={user ? "/dashboard" : "/login"}
            className="bg-terracotta text-white text-sm font-medium px-5 py-3 text-center hover:bg-terracotta/90"
          >
            {user ? "Dashboard" : "Sign in"}
          </Link>
        </div>
      )}
    </nav>
  );
}
