export function Mark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect x="3" y="3" width="18" height="18" rx="5" fill="currentColor" opacity="0.9" />
      <rect x="11" y="11" width="18" height="18" rx="5" fill="var(--redleg)" opacity="0.92" />
      <rect x="11" y="11" width="10" height="10" rx="2.5" fill="var(--paper)" opacity="0.95" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="inline-flex items-center gap-2 text-ink">
      <Mark />
      <span className="font-serif text-[1.6rem] leading-none tracking-tight">Overlap</span>
    </span>
  );
}
