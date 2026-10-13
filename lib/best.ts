// Rank contiguous windows by how many people can make them.

export interface Person {
  id: string;
  name: string;
  slots: string;
}

export interface Window {
  start: number; // slot index
  len: number; // slots
  yes: string[]; // person ids, available
  maybe: string[]; // person ids, if needed
  missing: string[];
}

/**
 * Walk the slots in time order and cut a window wherever the set of people
 * who can make it changes, or where the next slot isn't adjacent in time.
 * Rank by available (counting if-needed as half), then by length.
 */
export function bestWindows(
  people: Person[],
  instants: number[],
  slotMin: number,
  opts: { limit?: number; required?: Set<string> } = {},
): Window[] {
  const { limit = 5, required } = opts;
  if (!people.length || !instants.length) return [];

  const order = instants.map((_, i) => i).sort((a, b) => instants[a] - instants[b]);
  const sig = (slot: number) => {
    let s = "";
    for (const p of people) s += p.slots[slot] ?? "0";
    return s;
  };

  const windows: Window[] = [];
  let start = -1;
  let current = "";
  let len = 0;
  const flush = () => {
    if (start < 0 || !/[12]/.test(current)) return;
    const yes: string[] = [];
    const maybe: string[] = [];
    const missing: string[] = [];
    people.forEach((p, i) => {
      if (current[i] === "1") yes.push(p.id);
      else if (current[i] === "2") maybe.push(p.id);
      else missing.push(p.id);
    });
    if (required && [...required].some((id) => missing.includes(id))) return;
    windows.push({ start, len, yes, maybe, missing });
  };

  let prevMs = -Infinity;
  for (const slot of order) {
    const s = sig(slot);
    const adjacent = instants[slot] - prevMs === slotMin * 60_000;
    if (s === current && adjacent) {
      len++;
    } else {
      flush();
      start = slot;
      current = s;
      len = 1;
    }
    prevMs = instants[slot];
  }
  flush();

  const score = (w: Window) => w.yes.length + w.maybe.length * 0.5;
  windows.sort((a, b) => score(b) - score(a) || b.len - a.len || instants[a.start] - instants[b.start]);
  return windows.slice(0, limit);
}
