"use client";

export function Segmented({
  value,
  onChange,
  options,
  size = "md",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: React.ReactNode; hint?: string }[];
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" className="inline-flex rounded-full bg-paper-2 p-1 border border-line/60">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`rounded-full font-medium transition-all duration-200 ${
              size === "sm" ? "px-3 py-1 text-[13px]" : "px-3.5 py-1.5 text-sm"
            } ${on ? "bg-card text-ink shadow-[0_1px_2px_rgb(10_22_34/0.12)]" : "text-muted hover:text-ink"}`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
