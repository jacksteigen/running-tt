"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionUser } from "@/components/SessionProvider";

/**
 * App-style bottom navigation on phones. Hidden on the onboarding and
 * sign-in screens so those flows stay focused.
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useSessionUser();
  const signedIn = !!user;

  if (pathname.startsWith("/welcome") || pathname.startsWith("/login")) return null;

  const tabs = [
    {
      href: "/",
      label: "Home",
      match: (p: string) => p === "/",
      icon: (
        <path d="M3 11.5 12 4l9 7.5M5 10v10h5v-6h4v6h5V10" />
      ),
    },
    {
      href: "/events",
      label: "Events",
      match: (p: string) => p.startsWith("/events"),
      icon: (
        <>
          <rect x="3" y="5" width="18" height="16" rx="1" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </>
      ),
    },
    {
      href: "/results",
      label: "Results",
      match: (p: string) => p.startsWith("/results") || p.startsWith("/athletes"),
      icon: (
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
      ),
    },
    {
      href: signedIn ? "/dashboard" : "/login",
      label: signedIn ? "You" : "Sign in",
      match: (p: string) => p.startsWith("/dashboard") || p.startsWith("/admin"),
      icon: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
        </>
      ),
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-midnight/92 backdrop-blur-md border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4">
        {tabs.map((t) => {
          const active = t.match(pathname);
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium uppercase tracking-[0.15em] transition-colors ${
                active ? "text-terracotta" : "text-stone/60 hover:text-white"
              }`}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                {t.icon}
              </svg>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
