import { fail, getEvent } from "@/lib/server";
import { occurrence } from "@/lib/time";

type Ctx = { params: Promise<{ id: string }> };

const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  const event = await getEvent(id);
  if (!event || event.final_start === null || event.final_len === null) return fail(404, "No time has been locked in yet.");

  const { start, end } = occurrence(event, event.final_start, event.final_len);
  const url = new URL(`/e/${event.id}`, req.url).toString();
  const weekly = event.kind === "weekdays" ? "RRULE:FREQ=WEEKLY\r\n" : "";

  const body =
    [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Red Leg Dev//Overlap//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${event.id}-${event.final_start}@overlap`,
      `DTSTAMP:${stamp(Date.now())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escape(event.title)}`,
      `DESCRIPTION:${escape([event.note, url].filter(Boolean).join("\n\n"))}`,
      `URL:${url}`,
      weekly.trim(),
      "END:VEVENT",
      "END:VCALENDAR",
    ]
      .filter(Boolean)
      .join("\r\n") + "\r\n";

  const filename = event.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "overlap";
  return new Response(body, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}.ics"`,
      "cache-control": "no-store",
    },
  });
}
