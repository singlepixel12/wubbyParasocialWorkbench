import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Toaster } from "@/components/ui/sonner";
import { PageTransition } from "@/components/PageTransition";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Wubby Parasocial Workbench",
    template: "%s | Wubby Parasocial Workbench",
  },
  description:
    "A web-based tool for analyzing and working with parasocial content from Wubby's streams. Video transcription, VOD diary management, and content analysis.",
  keywords: ["wubby", "vod", "transcript", "archive", "twitch", "kick"],
  openGraph: {
    title: "Wubby Parasocial Workbench",
    description:
      "Analyze Wubby stream content with video transcription, VOD diary, and content analysis tools.",
    url: "https://your-domain.com",
    siteName: "Wubby Parasocial Workbench",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary",
    title: "Wubby Parasocial Workbench",
    description:
      "Analyze Wubby stream content with video transcription, VOD diary, and content analysis tools.",
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
      </body>
    </html>
  );
}
