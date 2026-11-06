"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

type Props = Record<string, string | number | boolean>;

declare global {
  interface Window {
    plausible?: ((event: string, opts?: { u?: string; props?: Props; callback?: () => void }) => void) & { q?: unknown[] };
  }
}

// Poll ids are the only thing protecting a poll, and organizer/edit tokens
// live in the hash. Report a redacted URL so neither reaches analytics.
function redactedUrl() {
  const path = window.location.pathname.replace(/^\/e\/[^/]+/, "/e/:id");
  return `${window.location.origin}${path}`;
}

export function track(event: string, props?: Props, callback?: () => void) {
  try {
    window.plausible?.(event, { u: redactedUrl(), props, callback });
  } catch {}
}

// Plausible's outbound-links extension reports location.href, which would
// put the poll id in analytics. Track outbound clicks here instead, with the
// page redacted and only the destination's origin and path.
function trackOutbound(e: MouseEvent) {
  if (e.type === "auxclick" && e.button !== 1) return;
  const a = (e.target as Element | null)?.closest?.("a[href]");
  if (!(a instanceof HTMLAnchorElement) || !/^https?:$/.test(a.protocol) || a.host === window.location.host) return;
  const props = { url: a.origin + a.pathname };
  const sameTab =
    e.type === "click" &&
    !e.defaultPrevented &&
    !(e.ctrlKey || e.metaKey || e.shiftKey) &&
    (!a.target || /^_(self|parent|top)$/i.test(a.target));
  // Only hold the navigation when the real tracker is loaded (the queue stub
  // has `q` and never calls back), so blocked analytics adds no delay.
  if (!sameTab || !window.plausible || "q" in window.plausible) return track("Outbound Link: Click", props);
  e.preventDefault();
  let gone = false;
  const go = () => {
    if (gone) return;
    gone = true;
    window.location.assign(a.href);
  };
  track("Outbound Link: Click", props, go);
  setTimeout(go, 1000);
}

export function Analytics() {
  const pathname = usePathname();
  useEffect(() => {
    window.plausible =
      window.plausible ||
      Object.assign((...args: unknown[]) => (window.plausible!.q = window.plausible!.q || []).push(args), {});
    track("pageview");
  }, [pathname]);
  useEffect(() => {
    document.addEventListener("click", trackOutbound);
    document.addEventListener("auxclick", trackOutbound);
    return () => {
      document.removeEventListener("click", trackOutbound);
      document.removeEventListener("auxclick", trackOutbound);
    };
  }, []);
  return null;
}
