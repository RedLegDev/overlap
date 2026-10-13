"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, opts?: { u?: string; props?: Props }) => void) & { q?: unknown[] };
  }
}

// Poll ids are the only thing protecting a poll, and organizer/edit tokens
// live in the hash. Report a redacted URL so neither reaches analytics.
function redactedUrl() {
  const path = window.location.pathname.replace(/^\/e\/[^/]+/, "/e/:id");
  return `${window.location.origin}${path}`;
}

export function track(event: string, props?: Props) {
  try {
    window.plausible?.(event, { u: redactedUrl(), props });
  } catch {}
}

export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    window.plausible =
      window.plausible ||
      Object.assign((...args: unknown[]) => (window.plausible!.q = window.plausible!.q || []).push(args), {});
    track("pageview");
  }, [pathname]);
  return null;
}
