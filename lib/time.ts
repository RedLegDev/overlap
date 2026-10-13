// Slot math shared by the server and the browser.
//
// A poll's slots are defined in the event's time zone and indexed day-major:
// index = dayIndex * perDay + timeIndex. Each slot maps to one UTC instant,
// which is what lets the client re-lay the grid out in any viewer's zone.

export type EventKind = "dates" | "weekdays";

export interface EventShape {
  timezone: string;
  kind: EventKind;
  days: (string | number)[];
  start_min: number;
  end_min: number;
  slot_min: number;
}

// Weekday polls aren't tied to real dates. Anchor them to a fixed reference
// week (Sunday 2024-01-07) so they still convert across zones.
const REFERENCE_SUNDAY = { y: 2024, m: 1, d: 7 };

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const WEEKDAY_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function slotsPerDay(e: Pick<EventShape, "start_min" | "end_min" | "slot_min">) {
  return Math.max(0, Math.floor((e.end_min - e.start_min) / e.slot_min));
}

export function slotCount(e: EventShape) {
  return slotsPerDay(e) * e.days.length;
}

function ymd(day: string | number, kind: EventKind) {
  if (kind === "weekdays") {
    const dt = new Date(
      Date.UTC(REFERENCE_SUNDAY.y, REFERENCE_SUNDAY.m - 1, REFERENCE_SUNDAY.d + Number(day)),
    );
    return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
  }
  const [y, m, d] = String(day).split("-").map(Number);
  return { y, m, d };
}

const partsCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = partsCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      weekday: "short",
    });
    partsCache.set(tz, f);
  }
  return f;
}

export interface ZonedParts {
  y: number;
  m: number;
  d: number;
  minute: number; // minutes after local midnight
  weekday: number; // 0 = Sunday
}

export function zonedParts(ms: number, tz: string): ZonedParts {
  const p: Record<string, string> = {};
  for (const part of partsFormatter(tz).formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    minute: (Number(p.hour) % 24) * 60 + Number(p.minute),
    weekday: WEEKDAY_SHORT.indexOf(p.weekday),
  };
}

function offsetMinutes(ms: number, tz: string) {
  const z = zonedParts(ms, tz);
  const asUtc = Date.UTC(z.y, z.m - 1, z.d) + z.minute * 60_000;
  return Math.round((asUtc - Math.floor(ms / 60_000) * 60_000) / 60_000);
}

/** UTC ms for a wall-clock time in a zone. Non-existent DST times resolve forward. */
export function zonedToUtc(y: number, m: number, d: number, minute: number, tz: string) {
  const guess = Date.UTC(y, m - 1, d) + minute * 60_000;
  const first = guess - offsetMinutes(guess, tz) * 60_000;
  const second = guess - offsetMinutes(first, tz) * 60_000;
  for (const c of [second, first]) if (zonedParts(c, tz).minute === minute) return c;
  return Math.max(first, second);
}

/** UTC start instant of every slot, in slot-index order. */
export function slotInstants(e: EventShape): number[] {
  const per = slotsPerDay(e);
  const out: number[] = [];
  for (const day of e.days) {
    const { y, m, d } = ymd(day, e.kind);
    for (let i = 0; i < per; i++) {
      out.push(zonedToUtc(y, m, d, e.start_min + i * e.slot_min, e.timezone));
    }
  }
  return out;
}

export interface GridColumn {
  key: string;
  weekday: number;
  y: number;
  m: number;
  d: number;
}

export interface GridLayout {
  tz: string;
  columns: GridColumn[];
  rows: number[]; // minutes after local midnight
  gapBefore: boolean[]; // row starts after a jump in time (e.g. wrapping past midnight)
  cell: (number | -1)[][]; // [row][col] -> slot index, -1 when the poll has no slot there
  slotOf: { row: number; col: number }[]; // slot index -> position
}

/**
 * Bucket slot instants into a day × time grid as seen from `tz`. Returns null
 * when the zone's offset doesn't line up with the slot length (e.g. a +5:30
 * viewer on hourly slots), in which case callers fall back to the event zone.
 */
export function layoutGrid(e: EventShape, tz: string): GridLayout | null {
  const instants = slotInstants(e);
  const colMap = new Map<string, GridColumn>();
  const rowSet = new Set<number>();
  const placed: { col: string; minute: number }[] = [];

  for (const ms of instants) {
    const z = zonedParts(ms, tz);
    const key =
      e.kind === "weekdays"
        ? `w${z.weekday}`
        : `${z.y}-${String(z.m).padStart(2, "0")}-${String(z.d).padStart(2, "0")}`;
    if (!colMap.has(key)) colMap.set(key, { key, weekday: z.weekday, y: z.y, m: z.m, d: z.d });
    rowSet.add(z.minute);
    placed.push({ col: key, minute: z.minute });
  }

  const misaligned = [...rowSet].some((m) => (m - e.start_min) % e.slot_min !== 0);
  if (misaligned && tz !== e.timezone) return null;

  const columns = [...colMap.values()].sort((a, b) =>
    e.kind === "weekdays" ? weekdayOrder(a.weekday) - weekdayOrder(b.weekday) : a.key.localeCompare(b.key),
  );
  const rows = [...rowSet].sort((a, b) => a - b);
  const gapBefore = rows.map((m, i) => i > 0 && m - rows[i - 1] !== e.slot_min);

  const colIndex = new Map(columns.map((c, i) => [c.key, i]));
  const rowIndex = new Map(rows.map((r, i) => [r, i]));
  const cell = rows.map(() => columns.map(() => -1 as number));
  const slotOf: { row: number; col: number }[] = [];
  placed.forEach((p, slot) => {
    const row = rowIndex.get(p.minute) ?? -1;
    const col = colIndex.get(p.col) ?? -1;
    slotOf[slot] = { row, col };
    if (row >= 0 && col >= 0 && cell[row][col] === -1) cell[row][col] = slot;
  });
  return { tz, columns, rows, gapBefore, cell, slotOf };
}

// Monday-first for weekday polls.
function weekdayOrder(w: number) {
  return (w + 6) % 7;
}

export function formatMinute(minute: number, opts: { compact?: boolean } = {}) {
  const h = Math.floor(minute / 60) % 24;
  const m = minute % 60;
  const suffix = h < 12 ? "am" : "pm";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (opts.compact && m === 0) return `${h12}${suffix}`;
  return `${h12}:${String(m).padStart(2, "0")}${opts.compact ? suffix : ` ${suffix.toUpperCase()}`}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatColumn(c: GridColumn, kind: EventKind) {
  if (kind === "weekdays") return { top: WEEKDAY_SHORT[c.weekday], bottom: "" };
  return { top: WEEKDAY_SHORT[c.weekday], bottom: `${MONTHS[c.m - 1]} ${c.d}` };
}

export function formatRangeParts(startMs: number, endMs: number, tz: string, kind: EventKind) {
  const a = zonedParts(startMs, tz);
  const b = zonedParts(endMs, tz);
  const day =
    kind === "weekdays" ? WEEKDAY_LONG[a.weekday] : `${WEEKDAY_SHORT[a.weekday]}, ${MONTHS[a.m - 1]} ${a.d}`;
  return { day, time: `${formatMinute(a.minute)} – ${formatMinute(b.minute)}` };
}

export function formatInstantRange(startMs: number, endMs: number, tz: string, kind: EventKind) {
  const { day, time } = formatRangeParts(startMs, endMs, tz, kind);
  return `${day} · ${time}`;
}

export function describeDays(e: Pick<EventShape, "kind" | "days">) {
  if (e.kind === "weekdays") {
    return [...e.days]
      .map(Number)
      .sort((a, b) => weekdayOrder(a) - weekdayOrder(b))
      .map((d) => WEEKDAY_SHORT[d])
      .join(", ");
  }
  const sorted = [...e.days].map(String).sort();
  const fmt = (s: string) => {
    const [, m, d] = s.split("-").map(Number);
    return `${MONTHS[m - 1]} ${d}`;
  };
  if (sorted.length === 1) return fmt(sorted[0]);
  return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])} · ${sorted.length} days`;
}

export function shortZone(tz: string, at = Date.now()) {
  try {
    const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
      .formatToParts(new Date(at))
      .find((p) => p.type === "timeZoneName")?.value;
    return name ?? tz;
  } catch {
    return tz;
  }
}

export function zoneCity(tz: string) {
  return tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
}

/**
 * Real start/end instants for a run of slots. Weekday polls resolve to the
 * next upcoming occurrence of that weekday in the event's zone.
 */
export function occurrence(e: EventShape, start: number, len: number, now = Date.now()) {
  const per = slotsPerDay(e);
  const day = e.days[Math.floor(start / per)];
  const minute = e.start_min + (start % per) * e.slot_min;
  const duration = len * e.slot_min;
  let y: number, m: number, d: number;
  if (e.kind === "weekdays") {
    const today = zonedParts(now, e.timezone);
    const ahead = (Number(day) - today.weekday + 7) % 7;
    const dt = new Date(Date.UTC(today.y, today.m - 1, today.d + ahead));
    [y, m, d] = [dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate()];
  } else {
    ({ y, m, d } = ymd(day, e.kind));
  }
  const startMs = zonedToUtc(y, m, d, minute, e.timezone);
  return { start: startMs, end: startMs + duration * 60_000 };
}
