import type { Metadata, Viewport } from "next";
import "@fontsource-variable/geist";
import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "./globals.css";
import { Wordmark } from "@/components/Logo";

export const metadata: Metadata = {
  title: { default: "Overlap — find a time that works", template: "%s · Overlap" },
  description:
    "Free group scheduling poll. Pick some days, share a link, everyone paints when they're free. No accounts, no ads. Open source from Red Leg Dev.",
  icons: { icon: "/icon.svg" },
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
      <body className="min-h-dvh flex flex-col">
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
          <p>
            Free and open source.{" "}
            <a className="underline decoration-line underline-offset-4 hover:text-ink" href="https://github.com/RedLegDev/overlap">
              Source on GitHub
            </a>
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
