import type { Metadata } from "next";
import { Archivo, Newsreader } from "next/font/google";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MobileTabBar from "@/components/MobileTabBar";
import { SessionProvider } from "@/components/SessionProvider";
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

const SITE_URL = "https://runningtt.com";

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
    url: SITE_URL,
    title: "Running TT · You. The clock. Nothing else.",
    description:
      "Time trial running events held around the world. Rolling heats and real prize money at every race.",
    images: [{ url: "/images/athlete-track-lane.jpg", width: 1600, height: 1067, alt: "Running TT" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Running TT · You. The clock. Nothing else.",
    description:
      "Time trial running events held around the world. Rolling heats and real prize money at every race.",
    images: ["/images/athlete-track-lane.jpg"],
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
