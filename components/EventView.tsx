"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { bestWindows, type Window } from "@/lib/best";
import {
  describeDays,
  formatInstantRange,
  formatMinute,
  formatRangeParts,
  layoutGrid,
  occurrence,
  shortZone,
  slotInstants,
  zoneCity,
} from "@/lib/time";
import type { PublicEvent, PublicResponse } from "@/lib/server";
import { Grid, type Brush } from "./Grid";
import { Segmented } from "./ui";
import { track } from "./Analytics";

interface Initial {
  event: PublicEvent;
  responses: PublicResponse[];
  v: number;
}

interface Stored {
  admin?: string;
  rid?: string;
  token?: string;
}

const storageKey = (id: string) => `overlap:${id}`;

function readStored(id: string): Stored {
  try {
    return JSON.parse(localStorage.getItem(storageKey(id)) || "{}");
  } catch {
    return {};
  }
}

function writeStored(id: string, s: Stored) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(s));
  } catch {}
}

export function EventView({ initial }: { initial: Initial }) {
  const [event, setEvent] = useState(initial.event);
  const [responses, setResponses] = useState(initial.responses);
  const [stored, setStored] = useState<Stored>({});
  const [isNew, setIsNew] = useState(false);
  const [emailed, setEmailed] = useState<null | boolean>(null);
  const [viewTz, setViewTz] = useState(initial.event.timezone);
  const [localTz, setLocalTz] = useState(initial.event.timezone);
  const [tab, setTab] = useState<"you" | "group" | "best">("you");
  const [brush, setBrush] = useState<Brush>("1");
  const [draft, setDraft] = useState<string | null>(null);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [inspect, setInspect] = useState<{ slot: number; sticky: boolean } | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<Window | null>(null);
  const [required, setRequired] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const version = useRef(initial.v);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);

  const id = event.id;
  const me = stored.rid ? responses.find((r) => r.id === stored.rid) ?? null : null;
  const admin = stored.admin ?? null;

  // ---- boot: hash links, stored identity, time zone ---------------------
  useEffect(() => {
    const s = readStored(id);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    if (hash.get("admin")) s.admin = hash.get("admin")!;
    const meLink = hash.get("me");
    if (meLink && meLink.includes(".")) {
      const [rid, token] = meLink.split(".");
      s.rid = rid;
      s.token = token;
    }
    if (hash.get("new")) setIsNew(true);
    if (hash.get("emailed")) setEmailed(hash.get("emailed") === "1");
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
    writeStored(id, s);
    setStored(s);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || event.timezone;
    setLocalTz(tz);
    setViewTz(tz);
    if (s.rid) setTab("you");
  }, [id, event.timezone]);

  // ---- live refresh -----------------------------------------------------
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/events/${id}?v=${version.current}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Partial<Initial> & { unchanged?: boolean; v: number };
      if (data.unchanged || !data.event || !data.responses) return;
      version.current = data.v;
      setEvent(data.event);
      setResponses((prev) => {
        const mine = prev.find((r) => r.id === stored.rid);
        return data.responses!.map((r) =>
          r.id === stored.rid && pending.current !== null && mine ? { ...r, slots: mine.slots } : r,
        );
      });
    } catch {}
  }, [id, stored.rid]);

  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && refresh();
    const timer = setInterval(tick, 8000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // ---- derived ----------------------------------------------------------
  const instants = useMemo(() => slotInstants(event), [event]);
  const layout = useMemo(
    () => layoutGrid(event, viewTz) ?? layoutGrid(event, event.timezone)!,
    [event, viewTz],
  );
  const shownTz = layout.tz;
  const total = instants.length;

  const counts = useMemo(() => {
    const yes = new Array(total).fill(0);
    const maybe = new Array(total).fill(0);
    for (const r of responses) {
      for (let i = 0; i < total; i++) {
        if (r.slots[i] === "1") yes[i]++;
        else if (r.slots[i] === "2") maybe[i]++;
      }
    }
    return { yes, maybe };
  }, [responses, total]);

  const windows = useMemo(
    () =>
      bestWindows(responses, instants, event.slot_min, {
        limit: 6,
        required: required.size ? required : undefined,
      }),
    [responses, instants, event.slot_min, required],
  );

  const finalSet = useMemo(() => {
    if (event.final_start == null || event.final_len == null) return undefined;
    return new Set(Array.from({ length: event.final_len }, (_, i) => event.final_start! + i));
  }, [event.final_start, event.final_len]);

  const hoverSet = useMemo(
    () => (hover ? new Set(Array.from({ length: hover.len }, (_, i) => hover.start + i)) : undefined),
    [hover],
  );

  const nameOf = useMemo(() => new Map(responses.map((r) => [r.id, r.name])), [responses]);

  const rangeParts = (start: number, len: number) =>
    formatRangeParts(instants[start], instants[start] + len * event.slot_min * 60_000, shownTz, event.kind);
  const rangeLabel = (start: number, len: number) => {
    const p = rangeParts(start, len);
    return `${p.day} · ${p.time}`;
  };

  // ---- actions ----------------------------------------------------------
  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  }

  async function api(path: string, init: RequestInit & { token?: string | null } = {}) {
    const { token, ...rest } = init;
    const res = await fetch(path, {
      ...rest,
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) throw new Error(String(data.error || "Something went wrong. Try again."));
    return data;
  }

  async function join(name: string) {
    const data = await api(`/api/events/${id}/responses`, { method: "POST", body: JSON.stringify({ name }) });
    track("Poll Joined");
    const next = { ...stored, rid: String(data.id), token: String(data.token) };
    writeStored(id, next);
    setStored(next);
    setResponses((prev) => [
      ...prev,
      { id: String(data.id), name: String(data.name), slots: "0".repeat(total), updated_at: Date.now() },
    ]);
  }

  function paint(next: string) {
    if (!me) return;
    setResponses((prev) => prev.map((r) => (r.id === me.id ? { ...r, slots: next } : r)));
    pending.current = next;
    setSave("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 500);
  }

  async function flush() {
    const slots = pending.current;
    if (slots === null || !stored.rid) return;
    try {
      await api(`/api/events/${id}/responses/${stored.rid}`, {
        method: "PUT",
        token: stored.token,
        body: JSON.stringify({ slots }),
      });
      if (pending.current === slots) pending.current = null;
      setSave("saved");
    } catch {
      setSave("error");
    }
  }

  async function rename(name: string) {
    if (!me) return;
    await api(`/api/events/${id}/responses/${me.id}`, { method: "PUT", token: stored.token, body: JSON.stringify({ name }) });
    setResponses((prev) => prev.map((r) => (r.id === me.id ? { ...r, name } : r)));
  }

  async function removeResponse(rid: string) {
    const token = rid === stored.rid ? stored.token : admin;
    await api(`/api/events/${id}/responses/${rid}`, { method: "DELETE", token });
    setResponses((prev) => prev.filter((r) => r.id !== rid));
    if (rid === stored.rid) {
      const next = { admin: stored.admin };
      writeStored(id, next);
      setStored(next);
    }
    if (focus === rid) setFocus(null);
  }

  async function lockIn(w: Window | null) {
    await api(`/api/events/${id}`, {
      method: "PATCH",
      token: admin,
      body: JSON.stringify(w ? { final_start: w.start, final_len: w.len } : { final_start: null }),
    });
    setEvent((e) => ({ ...e, final_start: w?.start ?? null, final_len: w?.len ?? null }));
    if (w) track("Time Locked In", { responses: responses.length });
    flash(w ? "Time locked in." : "Cleared.");
  }

  async function deletePoll() {
    await api(`/api/events/${id}`, { method: "DELETE", token: admin });
    try {
      localStorage.removeItem(storageKey(id));
    } catch {}
    window.location.href = "/";
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      flash(`${label} copied.`);
    } catch {
      flash("Couldn't copy. Select the link and copy it.");
    }
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/e/${id}` : `/e/${id}`;
  const timeRange = `${formatMinute(event.start_min)} – ${formatMinute(event.end_min % 1440 === 0 && event.end_min ? 0 : event.end_min)}`;

  // ---- render -----------------------------------------------------------
  const youPane = (
    <Card
      title={me ? "Your availability" : "Add your availability"}
      aside={me ? <SaveState state={save} /> : null}
    >
      {me ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <Segmented
              size="sm"
              value={brush}
              onChange={(v) => setBrush(v as Brush)}
              options={[
                { value: "1", label: <Swatch kind="yes">Available</Swatch> },
                { value: "2", label: <Swatch kind="maybe">If needed</Swatch> },
              ]}
            />
            <MeMenu
              name={me.name}
              onRename={rename}
              onCopyLink={() => copy(`${shareUrl}#me=${stored.rid}.${stored.token}`, "Personal link")}
              onRemove={() => removeResponse(me.id)}
            />
          </div>
          <Grid
            mode="edit"
            layout={layout}
            kind={event.kind}
            slotMin={event.slot_min}
            value={me.slots}
            brush={brush}
            onCommit={paint}
            final={finalSet}
          />
          <p className="mt-3 text-[13px] text-muted">Drag across the grid to mark times. Tap a day to fill it.</p>
        </>
      ) : (
        <JoinForm onJoin={join} />
      )}
    </Card>
  );

  const groupPane = (
    <Card
      title="Group"
      aside={
        <span className="text-[13px] text-muted tabular">
          {responses.length} {responses.length === 1 ? "response" : "responses"}
        </span>
      }
    >
      <div className="flex items-center justify-between gap-3 mb-4 min-h-8">
        {focus ? (
          <button
            onClick={() => setFocus(null)}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper pl-3 pr-2 py-1 text-[13px] font-medium"
          >
            Showing {nameOf.get(focus)}
            <span className="grid h-5 w-5 place-items-center rounded-full bg-paper/20" aria-hidden="true">
              ×
            </span>
          </button>
        ) : (
          <Legend total={responses.length} />
        )}
      </div>
      <Grid
        mode="group"
        layout={layout}
        kind={event.kind}
        slotMin={event.slot_min}
        yes={counts.yes}
        maybe={counts.maybe}
        total={responses.length}
        focus={focus ? responses.find((r) => r.id === focus)?.slots ?? null : null}
        inspect={inspect?.slot ?? null}
        onInspect={(slot, sticky) =>
          setInspect((cur) => {
            if (slot === null) return cur?.sticky ? cur : null;
            if (sticky && cur?.sticky && cur.slot === slot) return null;
            if (!sticky && cur?.sticky) return cur;
            return { slot, sticky };
          })
        }
        final={finalSet}
        highlight={hoverSet}
      />
      {inspect && (
        <Inspector
          label={rangeLabel(inspect.slot, 1)}
          responses={responses}
          slot={inspect.slot}
          onClose={() => setInspect(null)}
        />
      )}
    </Card>
  );

  const bestPane = (
    <Card title="Best times">
      {responses.length === 0 ? (
        <p className="text-[15px] text-muted">No responses yet. Share the link and results show up here as people respond.</p>
      ) : (
        <>
          {responses.length > 1 && (
            <div className="mb-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-2">Must attend</p>
              <div className="flex flex-wrap gap-1.5">
                {responses.map((r) => {
                  const on = required.has(r.id);
                  return (
                    <button
                      key={r.id}
                      aria-pressed={on}
                      onClick={() => {
                        const next = new Set(required);
                        if (on) next.delete(r.id);
                        else next.add(r.id);
                        setRequired(next);
                      }}
                      className={`rounded-full px-2.5 py-1 text-[13px] font-medium border transition ${
                        on ? "bg-ink text-paper border-ink" : "border-line text-ink-2 hover:border-ink/30"
                      }`}
                    >
                      {r.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          {windows.length === 0 ? (
            <p className="text-[15px] text-muted">
              {required.size ? "No time works for everyone marked must attend." : "Nobody has marked any times yet."}
            </p>
          ) : (
            <ol className="space-y-2" onMouseLeave={() => setHover(null)}>
              {windows.map((w, i) => {
                const avail = w.yes.length + w.maybe.length;
                const isFinal = event.final_start === w.start && event.final_len === w.len;
                return (
                  <li
                    key={`${w.start}-${w.len}`}
                    onMouseEnter={() => setHover(w)}
                    className={`group rounded-2xl border p-3.5 transition ${
                      isFinal ? "border-redleg/50 bg-redleg/[0.04]" : "border-line hover:border-ink/25 bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted">
                          {i === 0 && !required.size && <span className="text-redleg mr-1">★</span>}
                          {rangeParts(w.start, w.len).day}
                        </p>
                        <p className="mt-0.5 font-semibold text-[16px] tabular">{rangeParts(w.start, w.len).time}</p>
                      </div>
                      <Dots yes={w.yes.length} maybe={w.maybe.length} total={responses.length} />
                    </div>
                    <div className="mt-1.5 flex items-end justify-between gap-3">
                      <p className="text-[13px] text-muted">
                        {w.missing.length === 0 && w.maybe.length === 0 ? (
                          <span className="font-medium text-[rgb(var(--yes))]">Everyone</span>
                        ) : (
                          <>
                            <span className="font-medium text-ink-2 tabular">
                              {avail} of {responses.length}
                            </span>
                            {w.maybe.length > 0 && <span> · {w.maybe.map((p) => nameOf.get(p)).join(", ")} if needed</span>}
                            {w.missing.length > 0 && <span> · without {w.missing.map((p) => nameOf.get(p)).join(", ")}</span>}
                          </>
                        )}
                      </p>
                      {admin &&
                        (isFinal ? (
                          <button onClick={() => lockIn(null)} className="shrink-0 text-[13px] font-medium text-muted hover:text-ink">
                            Unlock
                          </button>
                        ) : (
                          <button
                            onClick={() => lockIn(w)}
                            className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-2 hover:bg-ink hover:text-paper hover:border-ink transition"
                          >
                            Lock in
                          </button>
                        ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
      {responses.length > 0 && (
        <div className="mt-6">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-muted mb-2">People</p>
          <ul className="divide-y divide-line-2">
            {responses.map((r) => {
              const marked = [...r.slots].filter((c) => c !== "0").length;
              return (
                <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                  <button
                    onClick={() => {
                      setFocus(focus === r.id ? null : r.id);
                      setTab("group");
                    }}
                    className={`min-w-0 flex items-center gap-2.5 text-left text-[15px] ${focus === r.id ? "font-semibold" : ""}`}
                  >
                    <Avatar name={r.name} />
                    <span className="truncate">
                      {r.name}
                      {r.id === stored.rid && <span className="text-muted font-normal"> (you)</span>}
                    </span>
                  </button>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-[12px] text-muted tabular">{marked ? `${marked} slots` : "nothing marked"}</span>
                    {admin && r.id !== stored.rid && (
                      <ConfirmButton onConfirm={() => removeResponse(r.id)} label="Remove" confirm="Remove?" small />
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );

  const final =
    event.final_start != null && event.final_len != null ? occurrence(event, event.final_start, event.final_len) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-8">
      {/* header */}
      <div className="pt-4 sm:pt-8 pb-6 rise">
        <h1 className="font-serif text-4xl sm:text-6xl leading-[1] tracking-tight text-balance">{event.title}</h1>
        {event.note && <p className="mt-3 text-[16px] text-ink-2 max-w-2xl whitespace-pre-line">{event.note}</p>}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[14px] text-ink-2">
          <span className="tabular">{describeDays(event)}</span>
          <span className="text-line hidden sm:inline">•</span>
          <span className="tabular">
            {timeRange} {zoneCity(event.timezone)} time
          </span>
          <ZonePicker value={viewTz} local={localTz} eventTz={event.timezone} onChange={setViewTz} fallback={shownTz !== viewTz} />
        </div>
      </div>

      {isNew && (
        <SharePanel
          url={shareUrl}
          adminUrl={admin ? `${shareUrl}#admin=${admin}` : null}
          fresh={isNew}
          emailed={emailed}
          onCopy={copy}
          onDismiss={() => setIsNew(false)}
        />
      )}
      {!isNew && (
        <div className="mb-5 flex flex-wrap gap-2">
          <button
            onClick={() => copy(shareUrl, "Link")}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-3.5 py-1.5 text-sm font-semibold hover:bg-ink-2"
          >
            <LinkIcon /> Copy poll link
          </button>
          {admin && (
            <button
              onClick={() => copy(`${shareUrl}#admin=${admin}`, "Organizer link")}
              className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3.5 py-1.5 text-sm font-medium text-ink-2 hover:border-ink/30"
              title="Lets you lock in a time or delete the poll from another device. Don't send it to the group."
            >
              Copy organizer link
            </button>
          )}
        </div>
      )}

      {final && (
        <div className="mb-6 rounded-3xl border border-redleg/40 bg-redleg/[0.05] p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rise">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wider text-redleg">Locked in</p>
            <p className="mt-1 font-serif text-2xl sm:text-3xl leading-tight">
              {formatInstantRange(final.start, final.end, shownTz, "dates")}
            </p>
            <p className="mt-1 text-[13px] text-muted">{shortZone(shownTz, final.start)}{event.kind === "weekdays" ? " · weekly" : ""}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/events/${id}/ics`}
              onClick={() => track("Calendar Export", { target: "ics" })}
              className="rounded-full bg-ink text-paper px-4 py-2 text-sm font-semibold hover:bg-ink-2"
            >
              Add to calendar
            </a>
            <a
              href={googleLink(event.title, event.note, shareUrl, final.start, final.end, event.kind === "weekdays")}
              target="_blank"
              rel="noreferrer"
              onClick={() => track("Calendar Export", { target: "google" })}
              className="rounded-full border border-line bg-card px-4 py-2 text-sm font-semibold hover:border-ink/30"
            >
              Google Calendar
            </a>
          </div>
        </div>
      )}

      {/* mobile tabs */}
      <div className="lg:hidden sticky top-0 z-30 -mx-4 px-4 py-2 mb-3 bg-paper/85 backdrop-blur border-b border-line/60 [&>div]:flex [&>div]:w-full [&_button]:flex-1">
        <Segmented
          value={tab}
          onChange={(v) => setTab(v as typeof tab)}
          options={[
            { value: "you", label: "You" },
            { value: "group", label: `Group · ${responses.length}` },
            { value: "best", label: "Best times" },
          ]}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px] items-start">
        <div className={tab === "you" ? "" : "hidden lg:block"}>{youPane}</div>
        <div className={tab === "group" ? "" : "hidden lg:block"}>{groupPane}</div>
        <div className={`${tab === "best" ? "" : "hidden lg:block"} lg:sticky lg:top-4`}>{bestPane}</div>
      </div>

      {admin && (
        <div className="mt-10 flex justify-end">
          <ConfirmButton onConfirm={deletePoll} label="Delete poll" confirm="Delete poll and all responses" />
        </div>
      )}

      <div
        aria-live="polite"
        className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-paper px-4 py-2 text-sm font-medium shadow-lg transition-all duration-300 ${
          toast ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2 pointer-events-none"
        }`}
      >
        {toast}
      </div>
    </div>
  );
}

// ---- pieces ---------------------------------------------------------------

function googleLink(title: string, note: string, url: string, start: number, end: number, weekly: boolean) {
  const f = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${f(start)}/${f(end)}`,
    details: [note, url].filter(Boolean).join("\n\n"),
  });
  if (weekly) p.set("recur", "RRULE:FREQ=WEEKLY");
  return `https://calendar.google.com/calendar/render?${p}`;
}

function Card({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-card p-4 sm:p-5 shadow-[0_1px_0_rgb(10_22_34/0.03)]">
      <header className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-serif text-[1.65rem] leading-none">{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function Swatch({ kind, children }: { kind: "yes" | "maybe"; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-[3px]"
        style={{
          background:
            kind === "yes"
              ? "rgb(var(--yes))"
              : "repeating-linear-gradient(135deg, rgb(var(--maybe)) 0 3px, rgb(var(--maybe) / 0.65) 3px 5px)",
        }}
      />
      {children}
    </span>
  );
}

function SaveState({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  return (
    <span
      className={`text-[13px] font-medium inline-flex items-center gap-1.5 ${state === "error" ? "text-redleg" : "text-muted"}`}
      aria-live="polite"
    >
      {state === "saving" && <span className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse" />}
      {state === "saved" && (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-[rgb(var(--yes))]">
          <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {state === "saving" ? "Saving" : state === "saved" ? "Saved" : "Not saved. Check your connection."}
    </span>
  );
}

function Legend({ total }: { total: number }) {
  if (!total) return <span className="text-[13px] text-muted">No responses yet.</span>;
  return (
    <div className="flex items-center gap-2 text-[12px] text-muted tabular">
      <span>0/{total}</span>
      <span className="flex">
        {Array.from({ length: Math.min(total, 8) + 1 }, (_, i) => {
          const r = i / Math.min(total, 8);
          return (
            <span
              key={i}
              className="h-3 w-4 first:rounded-l-[3px] last:rounded-r-[3px]"
              style={{ background: r ? `rgb(var(--yes) / ${0.1 + r * 0.9})` : "var(--cell-empty)", boxShadow: "inset 0 0 0 1px var(--line-2)" }}
            />
          );
        })}
      </span>
      <span>
        {total}/{total} available
      </span>
    </div>
  );
}

function Dots({ yes, maybe, total }: { yes: number; maybe: number; total: number }) {
  if (total > 12) {
    return (
      <span className="shrink-0 text-[13px] font-semibold tabular text-ink-2">
        {Math.round(((yes + maybe) / total) * 100)}%
      </span>
    );
  }
  return (
    <span className="shrink-0 mt-1.5 flex gap-[3px]" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full"
          style={{
            background: i < yes ? "rgb(var(--yes))" : i < yes + maybe ? "rgb(var(--maybe))" : "var(--line)",
          }}
        />
      ))}
    </span>
  );
}

function Inspector({
  label,
  responses,
  slot,
  onClose,
}: {
  label: string;
  responses: PublicResponse[];
  slot: number;
  onClose: () => void;
}) {
  const yes = responses.filter((r) => r.slots[slot] === "1");
  const maybe = responses.filter((r) => r.slots[slot] === "2");
  const no = responses.filter((r) => r.slots[slot] !== "1" && r.slots[slot] !== "2");
  return (
    <div className="mt-4 rounded-2xl bg-paper/70 border border-line p-3.5 text-[14px]">
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold tabular">{label}</p>
        <button onClick={onClose} className="text-muted hover:text-ink -mt-1 -mr-1 h-7 w-7 grid place-items-center rounded-full" aria-label="Close">
          ×
        </button>
      </div>
      {responses.length === 0 ? (
        <p className="text-muted">No responses yet.</p>
      ) : (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-[rgb(var(--yes))] font-semibold tabular">{yes.length}</dt>
          <dd>{yes.length ? yes.map((r) => r.name).join(", ") : <span className="text-muted">Available</span>}</dd>
          {maybe.length > 0 && (
            <>
              <dt className="text-[rgb(var(--maybe))] font-semibold tabular">{maybe.length}</dt>
              <dd>
                {maybe.map((r) => r.name).join(", ")} <span className="text-muted">if needed</span>
              </dd>
            </>
          )}
          {no.length > 0 && (
            <>
              <dt className="text-muted font-semibold tabular">{no.length}</dt>
              <dd className="text-muted">
                <s className="decoration-muted/50">{no.map((r) => r.name).join(", ")}</s>
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="h-7 w-7 shrink-0 rounded-full grid place-items-center text-[11px] font-bold text-white"
      style={{ background: `oklch(0.55 0.09 ${h})` }}
      aria-hidden="true"
    >
      {initials}
    </span>
  );
}

function JoinForm({ onJoin }: { onJoin: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!name.trim()) return setError("Enter your name.");
        setBusy(true);
        setError("");
        try {
          await onJoin(name.trim());
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <label htmlFor="name" className="block text-sm font-medium text-ink-2 mb-2">
        Your name
      </label>
      <div className="flex gap-2">
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          autoComplete="given-name"
          placeholder="Name"
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper/60 px-4 py-2.5 text-[16px] focus:bg-card focus:outline-none focus:ring-2 focus:ring-redleg/30"
        />
        <button
          disabled={busy}
          className="rounded-xl bg-ink text-paper px-5 text-[15px] font-semibold hover:bg-ink-2 disabled:opacity-60 transition"
        >
          {busy ? "Joining…" : "Continue"}
        </button>
      </div>
      {error && <p className="mt-2 text-[13px] text-redleg font-medium">{error}</p>}
      <p className="mt-3 text-[13px] text-muted">No account needed. This device remembers you.</p>
    </form>
  );
}

function MeMenu({
  name,
  onRename,
  onCopyLink,
  onRemove,
}: {
  name: string;
  onRename: (n: string) => Promise<void>;
  onCopyLink: () => void;
  onRemove: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-full border border-line pl-1 pr-2.5 py-1 text-[13px] font-medium hover:border-ink/30"
        aria-expanded={open}
      >
        <Avatar name={name} />
        <span className="max-w-[10rem] truncate">{name}</span>
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-40 w-64 rounded-2xl border border-line bg-card p-2 shadow-xl rise">
          {editing ? (
            <form
              className="p-1.5"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await onRename(value.trim());
                  setEditing(false);
                  setOpen(false);
                } catch (err) {
                  setError((err as Error).message);
                }
              }}
            >
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                maxLength={60}
                autoFocus
                className="w-full rounded-lg border border-line bg-paper/60 px-3 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-redleg/30"
              />
              {error && <p className="mt-1 text-[12px] text-redleg">{error}</p>}
              <button className="mt-2 w-full rounded-lg bg-ink text-paper py-1.5 text-sm font-semibold">Save name</button>
            </form>
          ) : (
            <>
              <MenuItem onClick={() => setEditing(true)}>Change name</MenuItem>
              <MenuItem
                onClick={() => {
                  onCopyLink();
                  setOpen(false);
                }}
              >
                Copy personal edit link
                <span className="block text-[12px] text-muted font-normal">Open it on another device to keep editing.</span>
              </MenuItem>
              <ConfirmMenuItem onConfirm={onRemove}>Remove my response</ConfirmMenuItem>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full text-left rounded-xl px-3 py-2 text-[14px] font-medium hover:bg-paper-2">
      {children}
    </button>
  );
}

function ConfirmMenuItem({ children, onConfirm }: { children: React.ReactNode; onConfirm: () => Promise<void> }) {
  const [armed, setArmed] = useState(false);
  return (
    <button
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`w-full text-left rounded-xl px-3 py-2 text-[14px] font-medium ${armed ? "bg-redleg text-white" : "text-redleg hover:bg-redleg/10"}`}
    >
      {armed ? "Tap again to remove" : children}
    </button>
  );
}

function ConfirmButton({
  onConfirm,
  label,
  confirm,
  small,
}: {
  onConfirm: () => Promise<void>;
  label: string;
  confirm: string;
  small?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={`rounded-full font-medium transition ${small ? "px-2 py-0.5 text-[12px]" : "px-4 py-2 text-sm"} ${
        armed ? "bg-redleg text-white" : "text-muted hover:text-redleg"
      }`}
    >
      {armed ? confirm : label}
    </button>
  );
}

function ZonePicker({
  value,
  local,
  eventTz,
  onChange,
  fallback,
}: {
  value: string;
  local: string;
  eventTz: string;
  onChange: (tz: string) => void;
  fallback: boolean;
}) {
  const [zones, setZones] = useState<string[]>([]);
  useEffect(() => {
    try {
      setZones((Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone"));
    } catch {}
  }, []);
  const pinned = [...new Set([local, eventTz])];
  return (
    <label className="relative inline-flex items-center gap-1.5 rounded-full border border-line bg-card pl-3 pr-8 py-1 hover:border-ink/30 cursor-pointer">
      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-muted" aria-hidden="true">
        <circle cx="10" cy="10" r="7.25" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10 6v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </svg>
      <span className="text-[13px] font-medium">
        {fallback ? `${zoneCity(eventTz)} time` : value === local ? `Your time (${shortZone(value)})` : `${zoneCity(value)} (${shortZone(value)})`}
      </span>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-muted"><path d="m6 8 4 4 4-4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
      <select
        aria-label="Show times in"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 opacity-0 cursor-pointer"
      >
        {pinned.map((z) => (
          <option key={`p-${z}`} value={z}>
            {z === local ? "Your time" : "Organizer's time"} · {z.replace(/_/g, " ")}
          </option>
        ))}
        <option disabled>──────────</option>
        {zones
          .filter((z) => !pinned.includes(z))
          .map((z) => (
            <option key={z} value={z}>
              {z.replace(/_/g, " ")}
            </option>
          ))}
      </select>
    </label>
  );
}

function LinkIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.8.8M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.8-.8"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SharePanel({
  url,
  adminUrl,
  fresh,
  emailed,
  onCopy,
  onDismiss,
}: {
  url: string;
  adminUrl: string | null;
  fresh: boolean;
  emailed: boolean | null;
  onCopy: (text: string, label: string) => void;
  onDismiss: () => void;
}) {
  const [canShare, setCanShare] = useState(false);
  useEffect(() => setCanShare(typeof navigator !== "undefined" && !!navigator.share), []);
  return (
    <div className={`mb-6 rounded-3xl border p-4 sm:p-5 rise ${fresh ? "border-ink bg-ink text-paper" : "border-line bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-semibold ${fresh ? "" : "text-ink"}`}>{fresh ? "Poll created. Send this link to the group." : "Share link"}</p>
          {emailed === true && <p className="mt-1 text-[13px] opacity-75">The poll and organizer links are in your inbox.</p>}
          {emailed === false && (
            <p className="mt-1 text-[13px] opacity-75">The email didn&rsquo;t send. Copy your organizer link below to keep it.</p>
          )}
        </div>
        {fresh && (
          <button onClick={onDismiss} className="-mt-1 -mr-1 h-7 w-7 grid place-items-center rounded-full hover:bg-paper/10" aria-label="Dismiss">
            ×
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-col sm:flex-row gap-2">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className={`min-w-0 flex-1 rounded-xl px-4 py-2.5 text-[15px] tabular font-medium ${
            fresh ? "bg-paper/10 text-paper border border-paper/20" : "bg-paper/60 border border-line"
          }`}
        />
        <div className="flex gap-2">
          <button
            onClick={() => onCopy(url, "Link")}
            className={`flex-1 sm:flex-none rounded-xl px-5 py-2.5 text-[15px] font-semibold transition ${
              fresh ? "bg-paper text-ink hover:bg-paper-2" : "bg-ink text-paper hover:bg-ink-2"
            }`}
          >
            Copy link
          </button>
          {canShare && (
            <button
              onClick={() => navigator.share({ url }).catch(() => {})}
              className={`rounded-xl px-4 py-2.5 text-[15px] font-semibold border ${fresh ? "border-paper/25" : "border-line"}`}
            >
              Share…
            </button>
          )}
        </div>
      </div>
      {adminUrl && (
        <details className={`mt-3 text-[13px] ${fresh ? "text-paper/75" : "text-muted"}`}>
          <summary className="cursor-pointer select-none">You&rsquo;re the organizer on this device</summary>
          <p className="mt-2">
            The organizer link lets you lock in a time or delete the poll from any device. Don&rsquo;t send it to the group.
          </p>
          <button
            onClick={() => onCopy(adminUrl, "Organizer link")}
            className={`mt-2 rounded-full px-3 py-1 font-semibold border ${fresh ? "border-paper/30 hover:bg-paper/10" : "border-line hover:border-ink/30 text-ink"}`}
          >
            Copy organizer link
          </button>
        </details>
      )}
    </div>
  );
}
