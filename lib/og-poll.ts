import type { PublicResponse } from "./server";
import {
  describeDays,
  formatInstantRange,
  formatMinute,
  layoutGrid,
  occurrence,
  slotCount,
  type EventShape,
} from "./time";

export const OG_COLORS = {
  paper: "#0b1620",
  card: "#12212e",
  ink: "#eef1f4",
  muted: "#8a9aab",
  line: "#233546",
  redleg: "#ea384c",
  yes: "rgb(52, 199, 134)",
  cellEmpty: "#0f1d29",
};

export function pollHourRange(e: EventShape) {
  const end = e.end_min % 1440 === 0 && e.end_min ? 0 : e.end_min;
  return `${formatMinute(e.start_min)} – ${formatMinute(end)}`;
}

export function responseCountLabel(n: number) {
  return n === 1 ? "1 response" : `${n} responses`;
}

export function pollOgLines(
  event: EventShape & { final_start: number | null; final_len: number | null; timezone: string; kind: EventShape["kind"] },
  responses: PublicResponse[],
) {
  const days = describeDays(event);
  const hours = pollHourRange(event);
  const count = responseCountLabel(responses.length);

  if (event.final_start != null && event.final_len != null) {
    const { start, end } = occurrence(event, event.final_start, event.final_len);
    const locked = formatInstantRange(start, end, event.timezone, event.kind);
    return { days, hours, count, locked };
  }
  return { days, hours, count, locked: null as string | null };
}

export interface HeatmapCell {
  background: string;
}

/** Stylized group heatmap in the event time zone; omitted when the grid is too large. */
export function pollHeatmap(event: EventShape, responses: PublicResponse[]): HeatmapCell[][] | null {
  const layout = layoutGrid(event, event.timezone);
  if (!layout) return null;
  const rows = layout.rows.length;
  const cols = layout.columns.length;
  if (!rows || !cols || rows > 28 || cols > 14) return null;

  const total = slotCount(event);
  if (!total) return null;

  const people = responses.length;
  const yes = new Array(total).fill(0);
  const maybe = new Array(total).fill(0);
  for (const r of responses) {
    for (let i = 0; i < total; i++) {
      if (r.slots[i] === "1") yes[i]++;
      else if (r.slots[i] === "2") maybe[i]++;
    }
  }

  const cellColor = (slot: number) => {
    if (slot < 0) return OG_COLORS.line;
    if (!people) return OG_COLORS.cellEmpty;
    const score = (yes[slot] + maybe[slot] * 0.5) / people;
    if (score <= 0) return OG_COLORS.cellEmpty;
    const alpha = 0.12 + score * 0.88;
    return `rgba(52, 199, 134, ${alpha.toFixed(3)})`;
  };

  return layout.cell.map((row) => row.map((slot) => ({ background: cellColor(slot) })));
}
