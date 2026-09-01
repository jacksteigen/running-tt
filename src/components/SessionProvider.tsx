"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export interface SessionUser {
  name: string;
  isAdmin: boolean;
  profileCompleted: boolean;
}

const SessionContext = createContext<{ user: SessionUser | null; loaded: boolean }>({
  user: null,
  loaded: false,
});

/**
 * One session lookup per page view, shared by the header and the mobile
 * tab bar, rather than each of them asking the server separately.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/session")
      .then((r) => r.json() as Promise<{ user: SessionUser | null }>)
      .then((d) => {
        if (alive) {
          setUser(d.user);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [pathname]);

  return (
    <SessionContext.Provider value={{ user, loaded }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionUser() {
  return useContext(SessionContext);
}
