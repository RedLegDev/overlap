import { test } from "node:test";
import assert from "node:assert/strict";
import { remapFinal, remapSlots, type GridShape } from "./remap.ts";

// 3 dates, 09:00–11:00, 30-minute slots: 4 slots per day, 12 total.
const base: GridShape = { days: ["2026-11-10", "2026-11-11", "2026-11-12"], start_min: 540, end_min: 660, slot_min: 30 };
// Day-major: Tue 1100, Wed 0120, Thu 2211.
const slots = "1100" + "0120" + "2211";

test("unchanged grid keeps every slot", () => {
  assert.equal(remapSlots(base, base, slots), slots);
});

test("added day starts empty in sorted position", () => {
  const to = { ...base, days: ["2026-11-09", ...base.days] };
  assert.equal(remapSlots(base, to, slots), "0000" + "1100" + "0120" + "2211");
});

test("removed day drops its slots", () => {
  const to = { ...base, days: ["2026-11-10", "2026-11-12"] };
  assert.equal(remapSlots(base, to, slots), "1100" + "2211");
});

test("shifted days keep answers on matching dates only", () => {
  // Window moves one day later: Wed and Thu survive, Fri is new.
  const to = { ...base, days: ["2026-11-11", "2026-11-12", "2026-11-13"] };
  assert.equal(remapSlots(base, to, slots), "0120" + "2211" + "0000");
});

test("narrowed hour range drops slots outside it", () => {
  // 09:30–10:30 keeps the middle two slots of each day.
  const to = { ...base, start_min: 570, end_min: 630 };
  assert.equal(remapSlots(base, to, slots), "10" + "12" + "21");
});

test("widened hour range pads new slots with 0", () => {
  const to = { ...base, start_min: 480, end_min: 720 };
  assert.equal(remapSlots(base, to, slots), "00110000" + "00012000" + "00221100");
});

test("weekday polls match by weekday number, not position", () => {
  const from: GridShape = { days: [1, 3, 5], start_min: 540, end_min: 600, slot_min: 30 };
  const to: GridShape = { days: [5, 2, 1], start_min: 540, end_min: 600, slot_min: 30 };
  assert.equal(remapSlots(from, to, "10" + "01" + "22"), "22" + "00" + "10");
});

test("slot length change is refused", () => {
  assert.throws(() => remapSlots(base, { ...base, slot_min: 60 }, slots));
});

test("locked-in time follows its day and minute", () => {
  const to = { ...base, days: ["2026-11-09", ...base.days] };
  // Wed 09:30 for two slots → index 5 on the old grid, 9 on the new.
  assert.deepEqual(remapFinal(base, to, 5, 2), { start: 9, len: 2 });
});

test("locked-in time is cleared when its day is removed", () => {
  const to = { ...base, days: ["2026-11-10", "2026-11-12"] };
  assert.equal(remapFinal(base, to, 5, 2), null);
});

test("locked-in time is cleared when the range cuts through it", () => {
  const to = { ...base, start_min: 540, end_min: 600 };
  // Tue 09:30–10:30 (index 1, len 2) loses its second slot.
  assert.equal(remapFinal(base, to, 1, 2), null);
});

test("no locked-in time stays none", () => {
  assert.equal(remapFinal(base, base, null, null), null);
});
