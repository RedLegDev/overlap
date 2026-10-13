"use client";

import { useCallback, useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

function loadScript() {
  if (window.turnstile) return Promise.resolve();
  let el = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`);
  if (!el) {
    el = document.createElement("script");
    el.src = SCRIPT;
    el.async = true;
    document.head.appendChild(el);
  }
  return new Promise<void>((resolve, reject) => {
    el!.addEventListener("load", () => resolve(), { once: true });
    el!.addEventListener("error", () => reject(new Error("Turnstile failed to load")), { once: true });
  });
}

/**
 * Invisible-unless-needed Turnstile. `token()` resolves with a fresh,
 * single-use token; call `reset()` after each submit.
 */
export function useTurnstile(siteKey: string) {
  const ref = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const current = useRef<string | null>(null);
  const waiters = useRef<((t: string) => void)[]>([]);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widget.current = window.turnstile.render(ref.current, {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (t: string) => {
            current.current = t;
            waiters.current.splice(0).forEach((w) => w(t));
          },
          "expired-callback": () => (current.current = null),
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
    };
  }, [siteKey]);

  const token = useCallback(
    () =>
      current.current
        ? Promise.resolve(current.current)
        : new Promise<string>((resolve) => waiters.current.push(resolve)),
    [],
  );

  const reset = useCallback(() => {
    current.current = null;
    if (widget.current) window.turnstile?.reset(widget.current);
  }, []);

  return { ref, token, reset };
}
