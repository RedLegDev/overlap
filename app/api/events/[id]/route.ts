import {
  limited,
  bearer,
  db,
  expiryFor,
  fail,
  getEvent,
  getResponses,
  json,
  publicEvent,
  tokenMatches,
  validateNewEvent,
  type EventRow,
} from "@/lib/server";
import { remapAll, remapFinal } from "@/lib/remap";
import { slotCount } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return fail(404, "This poll doesn't exist or has expired.");

  const since = Number(new URL(req.url).searchParams.get("v"));
  if (since && since === event.updated_at) return json({ unchanged: true, v: event.updated_at });

  const responses = await getResponses(id);
  return json({ event: publicEvent(event), responses, v: event.updated_at });
}

/** Organizer: edit the poll (body has `title`), or lock in / clear the final time. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await limited(req, "write");
  if (blocked) return blocked;
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return fail(404, "This poll doesn't exist or has expired.");
  if (!(await tokenMatches(bearer(req), event.admin_hash))) return fail(403, "Only the organizer can do that.");

  const raw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if ("title" in raw) return editEvent(event, raw);

  const body = raw as { final_start?: number | null; final_len?: number };
  let start: number | null = null;
  let len: number | null = null;
  if (body.final_start !== null && body.final_start !== undefined) {
    start = Number(body.final_start);
    len = Number(body.final_len ?? 1);
    const total = slotCount(event);
    if (!Number.isInteger(start) || !Number.isInteger(len) || start < 0 || len < 1 || start + len > total) {
      return fail(400, "That time isn't part of this poll.");
    }
  }
  await db()
    .prepare("UPDATE events SET final_start = ?, final_len = ?, updated_at = ? WHERE id = ?")
    .bind(start, len, Date.now(), id)
    .run();
  return json({ ok: true });
}

async function editEvent(event: EventRow, body: Record<string, unknown>) {
  const input = validateNewEvent({ ...body, kind: event.kind });
  if (typeof input === "string") return fail(400, input);

  const { results: rows } = await db()
    .prepare("SELECT id, slots FROM responses WHERE event_id = ?")
    .bind(event.id)
    .all<{ id: string; slots: string }>();
  if (rows.length && (input.slot_min !== event.slot_min || input.timezone !== event.timezone)) {
    return fail(400, "Slot length and time zone can't change once people have responded.");
  }

  // Only when the slot length is unchanged; with no responses there's nothing to carry over.
  const sameSlots = input.slot_min === event.slot_min;
  const remapped = sameSlots ? remapAll(event, input, rows.map((r) => r.slots)) : [];
  const final = sameSlots ? remapFinal(event, input, event.final_start, event.final_len) : null;

  // Every response write bumps events.updated_at, so pinning it makes the whole
  // batch a no-op if anyone changed the poll since we read it.
  const now = Date.now();
  const unchanged = "(SELECT updated_at FROM events WHERE id = ?) = ?";
  const results = await db().batch([
    ...rows.map((r, i) =>
      db()
        .prepare(`UPDATE responses SET slots = ? WHERE id = ? AND ${unchanged}`)
        .bind(remapped[i], r.id, event.id, event.updated_at),
    ),
    db()
      .prepare(
        `UPDATE events SET title = ?, note = ?, timezone = ?, days = ?, start_min = ?, end_min = ?, slot_min = ?,
          final_start = ?, final_len = ?, updated_at = ?, expires_at = ?
         WHERE id = ? AND updated_at = ?`,
      )
      .bind(
        input.title,
        input.note,
        input.timezone,
        JSON.stringify(input.days),
        input.start_min,
        input.end_min,
        input.slot_min,
        final?.start ?? null,
        final?.len ?? null,
        now,
        expiryFor(input, now),
        event.id,
        event.updated_at,
      ),
  ]);
  if (!results[results.length - 1].meta.changes) {
    return fail(409, "Someone updated the poll while you were editing. Try saving again.");
  }
  return json({ ok: true });
}

/** Organizer: delete the poll and every response. */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await limited(req, "write");
  if (blocked) return blocked;
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return fail(404, "This poll doesn't exist or has expired.");
  if (!(await tokenMatches(bearer(req), event.admin_hash))) return fail(403, "Only the organizer can do that.");
  await db().batch([
    db().prepare("DELETE FROM responses WHERE event_id = ?").bind(id),
    db().prepare("DELETE FROM events WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}
