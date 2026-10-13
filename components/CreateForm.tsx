"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatMinute, shortZone, WEEKDAY_SHORT } from "@/lib/time";
import { Segmented } from "./ui";
import { useTurnstile } from "./useTurnstile";

type Kind = "dates" | "weekdays";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

const iso = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function todayIso() {
  const t = new Date();
  return iso(t.getFullYear(), t.getMonth(), t.getDate());
}

function addDays(isoDate: string, n: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return iso(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}

function weekdayOf(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => i * 30);

export function CreateForm({ siteKey }: { siteKey: string }) {
  const human = useTurnstile(siteKey);
  const [mounted, setMounted] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [kind, setKind] = useState<Kind>("dates");
  const [dates, setDates] = useState<Set<string>>(new Set());
  const [weekdays, setWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [start, setStart] = useState(9 * 60);
  const [end, setEnd] = useState(17 * 60);
  const [slot, setSlot] = useState(30);
  const [tz, setTz] = useState("UTC");
  const [zones, setZones] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState("");
  const [cursor, setCursor] = useState({ y: 2026, m: 0 });

  useEffect(() => {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    setTz(zone);
    try {
      setZones((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"));
    } catch {
      setZones([zone]);
    }
    const t = todayIso();
    setToday(t);
    const [y, m] = t.split("-").map(Number);
    setCursor({ y, m: m - 1 });
    setMounted(true);
  }, []);

  // Snap the range to the slot length when it changes.
  useEffect(() => {
    setStart((s) => Math.floor(s / slot) * slot);
    setEnd((e) => Math.ceil(e / slot) * slot);
  }, [slot]);

  const dayCount = kind === "dates" ? dates.size : weekdays.size;
  const hours = Math.max(0, end - start) / 60;
  const slots = dayCount * Math.max(0, Math.floor((end - start) / slot));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!title.trim()) return setError("Give the poll a name.");
    if (!dayCount) return setError(kind === "dates" ? "Pick at least one date." : "Pick at least one day.");
    if (end <= start) return setError("End time must be after start time.");
    setBusy(true);
    try {
      const turnstile = await Promise.race([
        human.token(),
        new Promise<string>((resolve) => setTimeout(() => resolve(""), 8000)),
      ]);
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          note,
          timezone: tz,
          kind,
          days: kind === "dates" ? [...dates].sort() : [...weekdays],
          start_min: start,
          end_min: end,
          slot_min: slot,
          turnstile,
        }),
      });
      const data = (await res.json()) as { id?: string; adminToken?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || "Couldn't create the poll.");
      try {
        localStorage.setItem(`overlap:${data.id}`, JSON.stringify({ admin: data.adminToken }));
      } catch {}
      window.location.href = `/e/${data.id}#admin=${data.adminToken}&new=1`;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
      human.reset();
    }
  }

  return (
    <form onSubmit={submit} className="rounded-3xl border border-line bg-card shadow-[0_1px_0_rgb(10_22_34/0.04),0_24px_48px_-24px_rgb(10_22_34/0.18)]">
      <div className="p-5 sm:p-7 space-y-7">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-ink-2 mb-2">
            What are you scheduling?
          </label>
          <input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            placeholder="Quarterly planning, book club, Friday dinner"
            className="w-full rounded-xl border border-line bg-paper/60 px-4 py-3 text-lg placeholder:text-muted/70 focus:bg-card focus:outline-none focus:ring-4 focus:ring-redleg/10 focus:border-redleg/40 transition"
          />
          {showNote ? (
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Details for the group (optional)"
              className="mt-2 w-full rounded-xl border border-line bg-paper/60 px-4 py-2.5 text-[15px] placeholder:text-muted/70 focus:bg-card focus:outline-none focus:ring-4 focus:ring-redleg/10 focus:border-redleg/40 transition resize-none"
              autoFocus
            />
          ) : (
            <button type="button" onClick={() => setShowNote(true)} className="mt-2 text-sm text-muted hover:text-ink">
              + Add a note
            </button>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <span className="text-sm font-medium text-ink-2">Which days?</span>
            <Segmented
              value={kind}
              onChange={(v) => setKind(v as Kind)}
              options={[
                { value: "dates", label: "Specific dates" },
                { value: "weekdays", label: "Days of the week" },
              ]}
            />
          </div>
          {kind === "dates" ? (
            mounted ? (
              <DatePicker
                today={today}
                cursor={cursor}
                setCursor={setCursor}
                selected={dates}
                setSelected={setDates}
              />
            ) : (
              <div className="h-[340px] rounded-2xl bg-paper/60" />
            )
          ) : (
            <WeekdayPicker selected={weekdays} setSelected={setWeekdays} />
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          <div>
            <span className="block text-sm font-medium text-ink-2 mb-2">Between</span>
            <div className="flex items-center gap-2">
              <TimeSelect label="Start time" value={start} onChange={setStart} step={slot} max={1410} />
              <span className="text-muted">to</span>
              <TimeSelect label="End time" value={end} onChange={setEnd} step={slot} min={30} />
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-ink-2 mb-2">Slot length</span>
            <Segmented
              value={String(slot)}
              onChange={(v) => setSlot(Number(v))}
              options={[
                { value: "15", label: "15m" },
                { value: "30", label: "30m" },
                { value: "60", label: "1h" },
              ]}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tz" className="block text-sm font-medium text-ink-2 mb-2">
            Time zone
          </label>
          <div className="relative">
            <select
              id="tz"
              value={tz}
              onChange={(e) => setTz(e.target.value)}
              className="w-full appearance-none rounded-xl border border-line bg-paper/60 pl-4 pr-10 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-redleg/30"
            >
              {(zones.length ? zones : [tz]).map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")} ({shortZone(z)})
                </option>
              ))}
            </select>
            <Chevron />
          </div>
          <p className="mt-1.5 text-xs text-muted">Everyone else sees the grid in their own time zone.</p>
        </div>
        <div ref={human.ref} className="empty:hidden" />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-line px-5 sm:px-7 py-4 bg-paper/40 rounded-b-3xl">
        <p className="text-sm text-muted tabular" aria-live="polite">
          {error ? (
            <span className="text-redleg font-medium">{error}</span>
          ) : dayCount ? (
            <>
              {dayCount} {kind === "dates" ? (dayCount === 1 ? "date" : "dates") : dayCount === 1 ? "day" : "days"} ×{" "}
              {hours % 1 ? hours.toFixed(1) : hours} {hours === 1 ? "hour" : "hours"} · {slots} slots
            </>
          ) : kind === "dates" ? (
            "Click or drag across dates."
          ) : (
            "Pick days of the week."
          )}
        </p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-ink text-paper px-6 py-3 text-[15px] font-semibold hover:bg-ink-2 active:scale-[0.98] transition disabled:opacity-60"
        >
          {busy ? "Creating…" : "Create poll"}
          <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
            <path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </form>
  );
}

function Chevron() {
  return (
    <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" aria-hidden="true">
      <path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimeSelect({
  label,
  value,
  onChange,
  step,
  min = 0,
  max = 1440,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  min?: number;
  max?: number;
}) {
  const opts = TIME_OPTIONS.filter((t) => t >= min && t <= max && t % Math.max(step, 30) === 0);
  if (!opts.includes(value)) opts.push(value);
  opts.sort((a, b) => a - b);
  return (
    <div className="relative flex-1">
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full appearance-none rounded-xl border border-line bg-paper/60 pl-4 pr-9 py-2.5 text-[15px] tabular focus:outline-none focus:ring-2 focus:ring-redleg/30"
      >
        {opts.map((t) => (
          <option key={t} value={t}>
            {t === 1440 ? "Midnight" : t === 0 ? "Midnight" : t === 720 ? "Noon" : formatMinute(t)}
          </option>
        ))}
      </select>
      <Chevron />
    </div>
  );
}

function WeekdayPicker({ selected, setSelected }: { selected: Set<number>; setSelected: (s: Set<number>) => void }) {
  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {MONDAY_FIRST.map((d) => {
        const on = selected.has(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = new Set(selected);
              if (on) next.delete(d);
              else next.add(d);
              setSelected(next);
            }}
            className={`rounded-xl py-4 text-sm font-semibold transition active:scale-95 ${
              on ? "bg-ink text-paper" : "bg-paper/70 text-ink-2 hover:bg-paper-2 border border-line"
            }`}
          >
            {WEEKDAY_SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

function DatePicker({
  today,
  cursor,
  setCursor,
  selected,
  setSelected,
}: {
  today: string;
  cursor: { y: number; m: number };
  setCursor: (c: { y: number; m: number }) => void;
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
}) {
  const drag = useRef<{ mode: "add" | "remove"; seen: Set<string> } | null>(null);
  const [draft, setDraft] = useState<Set<string> | null>(null);
  const shown = draft ?? selected;

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday-first
    const days = new Date(Date.UTC(cursor.y, cursor.m + 1, 0)).getUTCDate();
    const out: (string | null)[] = Array.from({ length: lead }, () => null);
    for (let d = 1; d <= days; d++) out.push(iso(cursor.y, cursor.m, d));
    while (out.length % 7) out.push(null);
    return out;
  }, [cursor]);

  const canGoBack = cursor.y * 12 + cursor.m > Number(today.slice(0, 4)) * 12 + Number(today.slice(5, 7)) - 1;

  function apply(date: string) {
    const d = drag.current;
    if (!d || d.seen.has(date) || date < today) return;
    d.seen.add(date);
    setDraft((prev) => {
      const next = new Set(prev ?? selected);
      if (d.mode === "add") next.add(date);
      else next.delete(date);
      return next;
    });
  }

  function dateAt(x: number, y: number) {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-date]");
    return el?.dataset.date ?? null;
  }

  function quick(days: number, weekdaysOnly: boolean) {
    const next = new Set<string>();
    let d = today;
    while (next.size < days) {
      const wd = weekdayOf(d);
      if (!weekdaysOnly || (wd >= 1 && wd <= 5)) next.add(d);
      d = addDays(d, 1);
    }
    setSelected(next);
  }

  return (
    <div className="rounded-2xl border border-line bg-paper/40 p-3 sm:p-4 select-none">
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setCursor(cursor.m === 0 ? { y: cursor.y - 1, m: 11 } : { y: cursor.y, m: cursor.m - 1 })}
          disabled={!canGoBack}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-paper-2 disabled:opacity-30"
          aria-label="Previous month"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4"><path d="m12 5-5 5 5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span className="font-serif text-2xl leading-none">
          {MONTHS[cursor.m]} <span className="text-muted">{cursor.y}</span>
        </span>
        <button
          type="button"
          onClick={() => setCursor(cursor.m === 11 ? { y: cursor.y + 1, m: 0 } : { y: cursor.y, m: cursor.m + 1 })}
          className="h-9 w-9 grid place-items-center rounded-full hover:bg-paper-2"
          aria-label="Next month"
        >
          <svg viewBox="0 0 20 20" className="h-4 w-4"><path d="m8 5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wider text-muted mb-1">
        {MONDAY_FIRST.map((d) => (
          <span key={d}>{WEEKDAY_SHORT[d].slice(0, 2)}</span>
        ))}
      </div>
      <div
        className="grid grid-cols-7 gap-y-1 touch-none"
        onPointerDown={(e) => {
          const date = (e.target as HTMLElement).closest<HTMLElement>("[data-date]")?.dataset.date;
          if (!date || date < today) return;
          e.preventDefault();
          window.getSelection()?.removeAllRanges();
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          drag.current = { mode: selected.has(date) ? "remove" : "add", seen: new Set() };
          apply(date);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const date = dateAt(e.clientX, e.clientY);
          if (date) apply(date);
        }}
        onPointerUp={() => {
          if (draft) setSelected(draft);
          setDraft(null);
          drag.current = null;
        }}
        onPointerCancel={() => {
          setDraft(null);
          drag.current = null;
        }}
      >
        {cells.map((date, i) => {
          if (!date) return <span key={`blank-${i}`} />;
          const past = date < today;
          const on = shown.has(date);
          const isToday = date === today;
          const d = Number(date.slice(8));
          const prevOn = on && shown.has(addDays(date, -1)) && i % 7 !== 0;
          const nextOn = on && shown.has(addDays(date, 1)) && i % 7 !== 6;
          return (
            <button
              key={date}
              type="button"
              data-date={date}
              disabled={past}
              aria-pressed={on}
              aria-label={date}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                  const next = new Set(selected);
                  if (on) next.delete(date);
                  else next.add(date);
                  setSelected(next);
                }
              }}
              className={`relative aspect-square sm:aspect-[1.25] text-[15px] tabular font-medium transition-colors duration-100 ${
                past
                  ? "text-muted/40 cursor-not-allowed"
                  : on
                    ? "bg-ink text-paper"
                    : "text-ink hover:bg-paper-2"
              } ${on ? `${prevOn ? "rounded-l-md" : "rounded-l-xl"} ${nextOn ? "rounded-r-md" : "rounded-r-xl"}` : "rounded-xl"}`}
            >
              {d}
              {isToday && <span className={`absolute bottom-1.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full ${on ? "bg-paper" : "bg-redleg"}`} />}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip onClick={() => quick(7, false)}>Next 7 days</Chip>
        <Chip onClick={() => quick(5, true)}>Next 5 weekdays</Chip>
        <Chip onClick={() => quick(14, false)}>Next 2 weeks</Chip>
        {selected.size > 0 && <Chip onClick={() => setSelected(new Set())}>Clear</Chip>}
      </div>
    </div>
  );
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-line bg-card px-3 py-1.5 text-[13px] font-medium text-ink-2 hover:text-ink hover:border-ink/30 transition"
    >
      {children}
    </button>
  );
}
