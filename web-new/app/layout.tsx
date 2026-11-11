import type { Metadata, Viewport } from "next";
import { Fraunces, Hanken_Grotesk, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { PageTransition } from "@/components/PageTransition";
import { DownloadsReconciler } from "@/components/listen/DownloadsReconciler";
import { DownloadsAutoResume } from "@/components/listen/DownloadsAutoResume";
import "./globals.css";

// Display serif — expressive, editorial "archive" voice (mastheads, titles)
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

// Body grotesque — clean, characterful UI/metadata text
const hankenGrotesk = Hanken_Grotesk({
  variable: "--font-hanken",
  subsets: ["latin"],
  display: "swap",
});

// Mono — technical strings (hashes, URLs, filenames)
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0e0d0b",
};

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

// GitHub Pages; relative metadata URLs (Open Graph) resolve against it.
const SITE = "https://singlepixel12.github.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  applicationName: "The Wubby Archive",
  appleWebApp: { capable: true, title: "Wubby Archive", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: `${BASE}/icons/apple-touch-icon.png`,
  },
  title: {
    default: "The Wubby Archive",
    template: "%s | The Wubby Archive",
  },
  description:
    "Wubby's VODs with AI summaries and tags, a player with subtitles, and audio you can download and listen to with no signal.",
  keywords: ["wubby", "vod", "transcript", "archive", "twitch", "kick"],
  openGraph: {
    title: "The Wubby Archive",
    description: "Wubby's VODs with AI summaries and tags, and audio you can take offline.",
    url: `${BASE}/`,
    siteName: "The Wubby Archive",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "The Wubby Archive",
    description: "Wubby's VODs with AI summaries and tags, and audio you can take offline.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${fraunces.variable} ${hankenGrotesk.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        {/* Skip to main content link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-4 focus:bg-background focus:text-foreground focus:outline-ring"
        >
          Skip to main content
        </a>

        {/* Header with navigation */}
        <Header />

        {/* Main content area - reduced padding on mobile */}
        <main id="main-content" className="container mx-auto px-2 md:px-4 py-4 md:py-8">
          <PageTransition>
            {children}
          </PageTransition>
        </main>

        {/* Toast notifications */}
        <Toaster />

        {/* Fix up offline downloads whose background fetch vanished (renders nothing) */}
        <DownloadsReconciler />
        {/* Resume downloads that a flaky network paused (renders nothing) */}
        <DownloadsAutoResume />
      </body>
    </html>
  );
}
