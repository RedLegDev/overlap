import {
  limited,
  bearer,
  db,
  fail,
  getEvent,
  getResponses,
  json,
  publicEvent,
  tokenMatches,
} from "@/lib/server";
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

/** Organizer: lock in or clear the final time. */
export async function PATCH(req: Request, { params }: Ctx) {
  const blocked = await limited(req, "write");
  if (blocked) return blocked;
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return fail(404, "This poll doesn't exist or has expired.");
  if (!(await tokenMatches(bearer(req), event.admin_hash))) return fail(403, "Only the organizer can do that.");

  const body = (await req.json().catch(() => ({}))) as { final_start?: number | null; final_len?: number };
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
