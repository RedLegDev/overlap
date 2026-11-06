import {
  limited,
  bearer,
  cleanName,
  cleanSlots,
  db,
  fail,
  getEvent,
  json,
  tokenMatches,
  type ResponseRow,
} from "@/lib/server";
import { gridKey } from "@/lib/remap";
import { slotCount } from "@/lib/time";

const GRID_CHANGED = "The poll's times changed. Check your availability again.";

type Ctx = { params: Promise<{ id: string; rid: string }> };

async function load(id: string, rid: string) {
  const event = await getEvent(id);
  if (!event) return null;
  const response = await db()
    .prepare("SELECT * FROM responses WHERE id = ? AND event_id = ?")
    .bind(rid, id)
    .first<ResponseRow>();
  return response ? { event, response } : null;
}

/** Save availability (and optionally rename). Participant token only. */
export async function PUT(req: Request, { params }: Ctx) {
  const blocked = await limited(req, "write");
  if (blocked) return blocked;
  const { id, rid } = await params;
  const found = await load(id, rid);
  if (!found) return fail(404, "Response not found.");
  if (!(await tokenMatches(bearer(req), found.response.token_hash))) return fail(403, "This isn't your response.");

  const body = (await req.json().catch(() => ({}))) as { slots?: string; name?: string; grid?: string };
  // Slots painted on a grid the organizer has since edited would land on the wrong cells.
  if (body.slots !== undefined && body.grid !== undefined && body.grid !== gridKey(found.event)) {
    return fail(409, GRID_CHANGED);
  }
  const slots = body.slots === undefined ? found.response.slots : cleanSlots(body.slots, slotCount(found.event));
  if (slots === null) return fail(400, "Availability doesn't match this poll.");
  const name = body.name === undefined ? found.response.name : cleanName(body.name);
  if (!name) return fail(400, "Enter your name.");

  const now = Date.now();
  const e = found.event;
  try {
    // Pinned to the grid validated above, so an edit committing in between can't be overwritten.
    const [write] = await db().batch([
      db()
        .prepare(
          `UPDATE responses SET slots = ?, name = ?, updated_at = ? WHERE id = ? AND EXISTS
            (SELECT 1 FROM events WHERE id = ? AND days = ? AND start_min = ? AND end_min = ? AND slot_min = ?)`,
        )
        .bind(slots, name, now, rid, id, JSON.stringify(e.days), e.start_min, e.end_min, e.slot_min),
      db().prepare("UPDATE events SET updated_at = ? WHERE id = ?").bind(now, id),
    ]);
    if (!write.meta.changes) return fail(409, GRID_CHANGED);
  } catch (err) {
    if (String((err as Error)?.cause ?? err).includes("UNIQUE")) return fail(409, `Someone named ${name} already responded.`);
    throw err;
  }
  return json({ ok: true, updated_at: now });
}

/** Remove a response. The participant or the organizer can do this. */
export async function DELETE(req: Request, { params }: Ctx) {
  const blocked = await limited(req, "write");
  if (blocked) return blocked;
  const { id, rid } = await params;
  const found = await load(id, rid);
  if (!found) return fail(404, "Response not found.");
  const token = bearer(req);
  const allowed =
    (await tokenMatches(token, found.response.token_hash)) || (await tokenMatches(token, found.event.admin_hash));
  if (!allowed) return fail(403, "You can't remove this response.");

  const now = Date.now();
  await db().batch([
    db().prepare("DELETE FROM responses WHERE id = ?").bind(rid),
    db().prepare("UPDATE events SET updated_at = ? WHERE id = ?").bind(now, id),
  ]);
  return json({ ok: true });
}
