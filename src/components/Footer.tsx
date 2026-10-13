import Image from "next/image";
import Link from "next/link";

const columns = [
  {
    title: "Racing",
    links: [
      { href: "/events", label: "Upcoming races" },
      { href: "/results", label: "Results" },
      { href: "/format", label: "The format" },
    ],
  },
  {
    title: "Athletes",
    links: [
      { href: "/login", label: "Create your profile" },
      { href: "/dashboard", label: "Your page" },
      { href: "/about", label: "Why we built it" },
    ],
  },
  {
    title: "Partners",
    links: [{ href: "/about#brands", label: "Back the purse" }],
  },
];

export default function Footer() {
  return (
    <footer className="bg-midnight text-bone/65 mt-auto">
      <div className="mx-auto max-w-6xl px-6 pt-20 pb-10 md:pt-28">
        <p className="t-display text-bone text-[2.8rem] sm:text-[3.8rem] md:text-[5rem] max-w-3xl">
          See you on <em className="text-terracotta">the start line.</em>
        </p>

        <div className="mt-16 md:mt-20 grid grid-cols-2 md:grid-cols-4 gap-10 border-t rule-light pt-10">
          <div className="col-span-2 md:col-span-1">
            <p className="t-eyebrow text-bone tracking-[0.14em]">Running TT</p>
            <p className="t-caption mt-3 text-bone/55">You. The clock. Nothing else.</p>
          </div>
          {columns.map((c) => (
            <div key={c.title}>
              <p className="t-eyebrow text-bone/45">{c.title}</p>
              <ul className="mt-4 space-y-2.5">
                {c.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="link-draw text-[0.95rem] hover:text-bone transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 border-t rule-light pt-6 flex flex-col md:flex-row justify-between gap-4 text-[0.85rem]">
          {/* The lockup sits on the text baseline, the way the word did:
              wordmark on the line, pinwheel rising above it. */}
          <p>
            A{" "}
            <a
              href="https://www.steigen.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mx-1 py-3 -my-3 opacity-80 transition-opacity hover:opacity-100"
            >
              <Image
                src="/images/steigen-logo-white.png"
                alt="Steigen"
                width={93}
                height={22}
                className="inline-block h-[22px] w-auto align-baseline"
              />
            </a>{" "}
            initiative
          </p>
          <div className="flex items-center gap-5">
            <Link href="/terms" className="hover:text-bone transition-colors">
              Terms of entry
            </Link>
            <Link href="/privacy" className="hover:text-bone transition-colors">
              Privacy
            </Link>
            <span>&copy; {new Date().getFullYear()} Running TT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
