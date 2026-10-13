import { env } from "cloudflare:workers";

const FROM = { email: "overlap@redleg.dev", name: "Overlap" };

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function validEmail(raw: unknown) {
  const s = String(raw ?? "").trim();
  return s.length <= 254 && /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(s) ? s : null;
}

/** One-time email with the poll links. The address is never stored. */
export async function sendCreatedEmail(to: string, opts: { title: string; when: string; shareUrl: string; adminUrl: string }) {
  const { title, when, shareUrl, adminUrl } = opts;
  const text = [
    `Your poll "${title}" is ready.`,
    when,
    "",
    "Share this link with the group:",
    shareUrl,
    "",
    "Your organizer link (see results, lock in a time, or delete the poll). Keep it to yourself:",
    adminUrl,
    "",
    "Overlap is free and open source, built by Red Leg Dev. https://overlap.redleg.dev",
  ].join("\n");

  const button = (href: string, label: string, dark: boolean) =>
    `<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;border-radius:999px;font-weight:600;text-decoration:none;${
      dark ? "background:#0a1622;color:#f5f3ee" : "background:#ffffff;color:#0a1622;border:1px solid #dcd6c9"
    }">${label}</a>`;

  const html = `<!doctype html><html><body style="margin:0;background:#f5f3ee;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0a1622">
<div style="max-width:520px;margin:0 auto;padding:32px 20px">
  <p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px">Overlap</p>
  <div style="background:#fbfaf7;border:1px solid #dcd6c9;border-radius:20px;padding:28px">
    <h1 style="margin:0;font-family:Georgia,serif;font-weight:400;font-size:28px;line-height:1.15">${esc(title)}</h1>
    <p style="margin:8px 0 24px;color:#5c6b7a;font-size:15px">${esc(when)}</p>
    <p style="margin:0 0 10px;font-size:15px">Share this link with the group:</p>
    <p style="margin:0 0 24px">${button(shareUrl, "Open the poll", true)}</p>
    <p style="margin:0 0 6px;font-size:15px">Your organizer link lets you see results, lock in a time, or delete the poll from any device. Keep it to yourself.</p>
    <p style="margin:0">${button(adminUrl, "Organizer link", false)}</p>
  </div>
  <p style="margin:24px 0 0;color:#5c6b7a;font-size:13px">Overlap is free and open source, built by <a href="https://redleg.dev" style="color:#0a1622">Red Leg Dev</a>. Your email address isn't stored.</p>
</div></body></html>`;

  await env.SEND_EMAIL.send({ from: FROM, to, subject: `Your poll: ${title}`, text, html });
}
