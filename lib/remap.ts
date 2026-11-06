// Moving availability onto an edited poll grid.
//
// Slots are keyed by (day, minute of day) in the event's time zone, so a
// response survives added, removed and reordered days and a moved hour range.
// Slot length and time zone must not change here: the caller refuses those
// edits once anyone has responded.
//
// No imports, so `node --test` can load this file directly.

export interface GridShape {
  days: (string | number)[];
  start_min: number;
  end_min: number;
  slot_min: number;
}

function perDay(e: GridShape) {
  return Math.max(0, Math.floor((e.end_min - e.start_min) / e.slot_min));
}

/** Identifies a grid layout; a slot string only means something against the grid it was painted on. */
export function gridKey(e: GridShape) {
  return [e.days.join(","), e.start_min, e.end_min, e.slot_min].join("|");
}

/** Old slot index → new slot index (or -1 when the new grid drops it). */
function indexMap(from: GridShape, to: GridShape): number[] {
  if (from.slot_min !== to.slot_min) throw new Error("slot length changed");
  const fromPer = perDay(from);
  const toPer = perDay(to);
  const dayIndex = new Map(to.days.map((d, i) => [String(d), i]));
  const out = new Array<number>(from.days.length * fromPer).fill(-1);
  from.days.forEach((day, di) => {
    const ni = dayIndex.get(String(day));
    if (ni === undefined) return;
    for (let t = 0; t < fromPer; t++) {
      const minute = from.start_min + t * from.slot_min;
      const nt = (minute - to.start_min) / to.slot_min;
      if (Number.isInteger(nt) && nt >= 0 && nt < toPer) out[di * fromPer + t] = ni * toPer + nt;
    }
  });
  return out;
}

/** Remap many response strings at once. New slots start as "0". */
export function remapAll(from: GridShape, to: GridShape, responses: string[]): string[] {
  const map = indexMap(from, to);
  const size = to.days.length * perDay(to);
  return responses.map((slots) => {
    const next = new Array<string>(size).fill("0");
    map.forEach((ni, oi) => {
      if (ni >= 0 && slots[oi]) next[ni] = slots[oi];
    });
    return next.join("");
  });
}

export function remapSlots(from: GridShape, to: GridShape, slots: string): string {
  return remapAll(from, to, [slots])[0];
}

/** The locked-in window on the new grid, or null when it no longer fits as one unbroken run. */
export function remapFinal(
  from: GridShape,
  to: GridShape,
  start: number | null,
  len: number | null,
): { start: number; len: number } | null {
  if (start === null || len === null) return null;
  const map = indexMap(from, to);
  const first = map[start] ?? -1;
  if (first < 0) return null;
  for (let i = 1; i < len; i++) if (map[start + i] !== first + i) return null;
  return { start: first, len };
}
