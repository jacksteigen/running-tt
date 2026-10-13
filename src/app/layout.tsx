import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { SessionProvider } from "@/components/SessionProvider";
import { SHARE_IMAGE, SITE_URL } from "@/lib/site";
import "./globals.css";

// Editorial serif for headlines; a grotesk with a width axis for everything
// else, used narrow for times, clocks and labels like a race bib.
const display = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-display",
});

const sans = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
});

// The title and line a link preview shows under the share card.
const SHARE_TITLE = "Running TT · Time trials with real prize money";
const SHARE_DESCRIPTION =
  "Book a heat, race the clock, and chase a real prize purse. Every time goes on the record.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Running TT · You. The clock. Nothing else.",
  description:
    "Time trial running events held around the world. Rolling heats and real prize money at every race.",
  icons: {
    icon: "/favicon.png",
    apple: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    siteName: "Running TT",
    locale: "en_AU",
    // Relative, so every page that uses this card points at itself, not the
    // homepage. Next turns "./" into the page's own path on SITE_URL.
    url: "./",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE.url],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen flex flex-col font-sans antialiased has-tab-bar">
        <SessionProvider>
          <Nav />
          <main className="flex-1">{children}</main>
          <Footer />
          <MobileTabBar />
        </SessionProvider>
      </body>
    </html>
  );
}
