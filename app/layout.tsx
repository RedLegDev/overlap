import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./globals.css";
import { Wordmark } from "@/components/Logo";
import { SITE } from "@/lib/site";
import { Analytics } from "@/components/Analytics";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Overlap: free group scheduling poll", template: "%s · Overlap" },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.publisher.name, url: SITE.publisher.url }],
  publisher: SITE.publisher.name,
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    title: "Overlap: find the time everyone can make",
    description: SITE.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Overlap group availability heatmap" }],
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f3ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1620" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* Self-hosted, cookie-free Plausible. Manual mode so poll ids and hash tokens are redacted. */}
        <script
          defer
          data-domain="overlap.redleg.dev"
          src="https://analytics.redleg.dev/js/script.manual.file-downloads.outbound-links.pageview-props.tagged-events.js"
        />
      </head>
      <body className="min-h-dvh flex flex-col">
        <Analytics />
        <header className="mx-auto w-full max-w-7xl px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between">
          <a href="/" className="rounded-md" aria-label="Overlap home">
            <Wordmark />
          </a>
          <a
            href="/"
            className="text-sm font-medium text-ink-2 hover:text-ink rounded-full border border-line px-3.5 py-1.5 hover:bg-card transition-colors"
          >
            New poll
          </a>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="mx-auto w-full max-w-7xl px-4 sm:px-6 py-10 text-sm text-muted flex flex-wrap items-center justify-between gap-3">
          <p className="flex flex-wrap gap-x-4 gap-y-1">
            <a className="hover:text-ink" href="/when2meet-alternative">Overlap vs. when2meet</a>
            <span>
            Free and open source.{" "}
            <a className="underline decoration-line underline-offset-4 hover:text-ink" href="https://github.com/RedLegDev/overlap">
              Source on GitHub
            </a>
            </span>
          </p>
          <a href="https://redleg.dev" className="inline-flex items-center gap-2 hover:text-ink">
            <span>Built by</span>
            <span className="font-semibold tracking-tight text-ink">Red Leg Dev</span>
          </a>
        </footer>
      </body>
    </html>
  );
}
