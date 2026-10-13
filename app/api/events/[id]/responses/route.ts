import {
  cleanName,
  db,
  fail,
  getEvent,
  hashToken,
  json,
  LIMITS,
  randomId,
  randomToken,
} from "@/lib/server";
import { slotCount } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

/** Join a poll by name. Returns the token that authorizes edits to this response. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event) return fail(404, "This poll doesn't exist or has expired.");

  const body = (await req.json().catch(() => ({}))) as { name?: string };
  const name = cleanName(body.name);
  if (!name) return fail(400, "Enter your name.");

  const existing = await db()
    .prepare("SELECT COUNT(*) AS n, SUM(name = ? COLLATE NOCASE) AS taken FROM responses WHERE event_id = ?")
    .bind(name, id)
    .first<{ n: number; taken: number | null }>();
  if (existing?.taken) return fail(409, `Someone named ${name} already responded. Use your personal link to edit, or add a last initial.`);
  if ((existing?.n ?? 0) >= LIMITS.responses) return fail(409, "This poll is full.");

  const rid = randomId(12);
  const token = randomToken();
  const now = Date.now();
  await db().batch([
    db()
      .prepare(
        "INSERT INTO responses (id, event_id, name, token_hash, slots, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(rid, id, name, await hashToken(token), "0".repeat(slotCount(event)), now, now),
    db().prepare("UPDATE events SET updated_at = ? WHERE id = ?").bind(now, id),
  ]);
  return json({ id: rid, token, name }, { status: 201 });
}
