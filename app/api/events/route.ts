import {
  db,
  expiryFor,
  fail,
  hashToken,
  humanCheck,
  json,
  limited,
  randomId,
  randomToken,
  validateNewEvent,
} from "@/lib/server";
import { sendCreatedEmail, validEmail } from "@/lib/email";
import { describeDays, formatMinute, zoneCity } from "@/lib/time";

export async function POST(req: Request) {
  const blocked = await limited(req, "create");
  if (blocked) return blocked;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = validateNewEvent(body);
  if (typeof input === "string") return fail(400, input);
  const notHuman = await humanCheck(req, body?.turnstile);
  if (notHuman) return notHuman;
  const email = body?.email ? validEmail(body.email) : null;
  if (body?.email && !email) return fail(400, "That email address doesn't look right.");

  const now = Date.now();
  const id = randomId();
  const adminToken = randomToken();

  // Opportunistic sweep of expired polls; keeps storage flat without a cron.
  const sweep = "SELECT id FROM events WHERE expires_at < ? LIMIT 25";
  await db().batch([
    db().prepare(`DELETE FROM responses WHERE event_id IN (${sweep})`).bind(now),
    db().prepare(`DELETE FROM events WHERE id IN (${sweep})`).bind(now),
    db()
      .prepare(
        `INSERT INTO events (id, title, note, timezone, kind, days, start_min, end_min, slot_min,
          admin_hash, created_at, updated_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        input.title,
        input.note,
        input.timezone,
        input.kind,
        JSON.stringify(input.days),
        input.start_min,
        input.end_min,
        input.slot_min,
        await hashToken(adminToken),
        now,
        now,
        expiryFor(input, now),
      ),
  ]);

  // Never stored; a failed send doesn't block the poll.
  let emailed = false;
  if (email) {
    const origin = new URL(req.url).origin;
    try {
      await sendCreatedEmail(email, {
        title: input.title,
        when: `${describeDays(input)} · ${formatMinute(input.start_min)} – ${formatMinute(input.end_min % 1440)} ${zoneCity(input.timezone)} time`,
        shareUrl: `${origin}/e/${id}`,
        adminUrl: `${origin}/e/${id}#admin=${adminToken}`,
      });
      emailed = true;
    } catch (err) {
      console.error("created-email send failed", (err as Error)?.message);
    }
  }

  return json({ id, adminToken, emailed }, { status: 201 });
}
