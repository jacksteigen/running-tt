import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-midnight text-stone/60 mt-auto">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-10">
          <div>
            <p className="text-white font-semibold tracking-tight mb-3">
              RUNNING TT
            </p>
            <p className="text-sm leading-relaxed">
              You. The clock. Nothing else.
            </p>
          </div>

          <div>
            <p className="text-white text-sm font-medium mb-3">Racing</p>
            <div className="flex flex-col gap-2">
              <Link href="/events" className="text-sm hover:text-white transition-colors">
                Upcoming events
              </Link>
              <Link href="/results" className="text-sm hover:text-white transition-colors">
                Past results
              </Link>
              <Link href="/format" className="text-sm hover:text-white transition-colors">
                The format
              </Link>
            </div>
          </div>

          <div>
            <p className="text-white text-sm font-medium mb-3">About</p>
            <div className="flex flex-col gap-2">
              <Link href="/about" className="text-sm hover:text-white transition-colors">
                Why we built it
              </Link>
              <Link href="/login" className="text-sm hover:text-white transition-colors">
                Sign in
              </Link>
            </div>
          </div>

          <div>
            <p className="text-white text-sm font-medium mb-3">Connect</p>
            <div className="flex flex-col gap-2">
              <span className="text-sm">Instagram</span>
              <span className="text-sm">Strava Club</span>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs">
            A{" "}
            <a
              href="https://www.steigen.com.au"
              target="_blank"
              rel="noopener noreferrer"
              className="text-stone/80 hover:text-white underline underline-offset-4 decoration-stone/30 hover:decoration-white transition-colors"
            >
              Steigen
            </a>{" "}
            initiative
          </p>
          <div className="flex items-center gap-4 text-xs">
            <Link href="/terms" className="hover:text-white transition-colors">
              Terms of entry
            </Link>
            <Link href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </Link>
            <span>&copy; {new Date().getFullYear()} Running TT</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
