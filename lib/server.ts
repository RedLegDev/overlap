import { env } from "cloudflare:workers";
import { slotCount, type EventKind, type EventShape } from "./time";

export const db = () => env.DB;

export interface EventRow extends EventShape {
  id: string;
  title: string;
  note: string;
  admin_hash: string;
  final_start: number | null;
  final_len: number | null;
  created_at: number;
  updated_at: number;
  expires_at: number;
}

export interface ResponseRow {
  id: string;
  event_id: string;
  name: string;
  token_hash: string;
  slots: string;
  created_at: number;
  updated_at: number;
}

export type PublicEvent = Omit<EventRow, "admin_hash">;
export type PublicResponse = Pick<ResponseRow, "id" | "name" | "slots" | "updated_at">;

const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

export function randomId(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = "";
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return out;
}

export function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function tokenMatches(token: string | null | undefined, hash: string) {
  if (!token) return false;
  const candidate = await hashToken(token);
  if (candidate.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= candidate.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

function parseEvent(row: Record<string, unknown>): EventRow {
  return { ...(row as unknown as EventRow), days: JSON.parse(String(row.days)) };
}

export async function getEvent(id: string): Promise<EventRow | null> {
  const row = await db()
    .prepare("SELECT * FROM events WHERE id = ? AND expires_at > ?")
    .bind(id, Date.now())
    .first();
  return row ? parseEvent(row) : null;
}

export async function getResponses(eventId: string): Promise<PublicResponse[]> {
  const { results } = await db()
    .prepare("SELECT id, name, slots, updated_at FROM responses WHERE event_id = ? ORDER BY created_at")
    .bind(eventId)
    .all<PublicResponse>();
  return results;
}

export function publicEvent(e: EventRow): PublicEvent {
  const { admin_hash: _omit, ...rest } = e;
  return rest;
}

export async function touchEvent(id: string) {
  await db().prepare("UPDATE events SET updated_at = ? WHERE id = ?").bind(Date.now(), id).run();
}

export function json(data: unknown, init: ResponseInit = {}) {
  return Response.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...(init.headers ?? {}) },
  });
}

export function fail(status: number, error: string) {
  return json({ error }, { status });
}

export function bearer(req: Request) {
  const h = req.headers.get("authorization") ?? "";
  return h.startsWith("Bearer ") ? h.slice(7) : null;
}

// ---- validation ---------------------------------------------------------

export const LIMITS = {
  title: 120,
  note: 500,
  name: 60,
  dates: 62,
  slots: 4000,
  responses: 250,
};

export interface NewEvent {
  title: string;
  note: string;
  timezone: string;
  kind: EventKind;
  days: (string | number)[];
  start_min: number;
  end_min: number;
  slot_min: number;
}

function validZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function validateNewEvent(body: unknown): NewEvent | string {
  if (!body || typeof body !== "object") return "Invalid request.";
  const b = body as Record<string, unknown>;
  const title = String(b.title ?? "").trim().slice(0, LIMITS.title);
  const note = String(b.note ?? "").trim().slice(0, LIMITS.note);
  const timezone = String(b.timezone ?? "");
  const kind: EventKind | null = b.kind === "weekdays" ? "weekdays" : b.kind === "dates" ? "dates" : null;
  const start_min = Number(b.start_min);
  const end_min = Number(b.end_min);
  const slot_min = Number(b.slot_min);
  if (!title) return "Give the poll a name.";
  if (!validZone(timezone)) return "Unknown time zone.";
  if (!kind) return "Pick dates or days of the week.";
  if (![15, 30, 60].includes(slot_min)) return "Slot length must be 15, 30, or 60 minutes.";
  if (!Number.isInteger(start_min) || !Number.isInteger(end_min)) return "Pick a time range.";
  if (start_min < 0 || end_min > 1440 || end_min - start_min < slot_min) return "End time must be after start time.";
  if (start_min % slot_min || end_min % slot_min) return "Times must line up with the slot length.";

  const raw = Array.isArray(b.days) ? b.days : [];
  let days: (string | number)[];
  if (kind === "weekdays") {
    days = [...new Set(raw.map(Number))].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  } else {
    days = [...new Set(raw.map(String))]
      .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)))
      .sort();
    if (days.length > LIMITS.dates) return `Pick ${LIMITS.dates} dates or fewer.`;
  }
  if (!days.length) return kind === "weekdays" ? "Pick at least one day." : "Pick at least one date.";

  const shape = { timezone, kind, days, start_min, end_min, slot_min };
  if (slotCount(shape) > LIMITS.slots) return "That's too many time slots. Use fewer days, a shorter range, or longer slots.";
  return { title, note, ...shape };
}

export function expiryFor(e: NewEvent, now = Date.now()) {
  const sixtyDays = 60 * 86_400_000;
  if (e.kind === "weekdays") return now + 180 * 86_400_000;
  const last = String(e.days[e.days.length - 1]);
  return Math.max(Date.parse(`${last}T23:59:59Z`), now) + sixtyDays;
}

export function cleanName(raw: unknown) {
  return String(raw ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, LIMITS.name);
}

export function cleanSlots(raw: unknown, count: number) {
  const s = String(raw ?? "");
  if (s.length !== count || /[^012]/.test(s)) return null;
  return s;
}
