# Overlap — scope

A free, open-source group availability poll: one person proposes a window of days and hours, everyone paints when they're free, and the page shows where the group overlaps. Same job as when2meet, rebuilt for phones, time zones, and people who only open the link once.

Hosted free at Red Leg Dev's expense. That only works if one poll costs close to nothing to serve, so the cost model below drives most of the technical choices.

## What's wrong with when2meet

| Problem | What Overlap does instead |
| --- | --- |
| Drag-to-paint barely works on phones; the page scrolls instead of painting | Pointer Events with touch capture on the grid. Scroll from the time column or headers; paint everywhere else |
| Two side-by-side grids that don't fit a phone | One grid at a time on mobile with a You / Group / Best times switcher; side by side on desktop |
| No answer to "so when are we meeting?" | Ranked **Best times** list: contiguous windows, how many can make it, and who's missing |
| Hovering a cell is the only way to see who's free; doesn't work on touch | Tap or hover a cell for the names; tap a person to see only their availability |
| Time zones are a dropdown nobody notices | Detected from the browser; the grid is re-laid out in the viewer's zone, with the event's zone one tap away |
| Only yes/no | Yes and **If needed**, painted with separate brushes |
| "Password" to edit your own row, which nobody remembers | Device remembers you; a personal edit link moves you to another device |
| Organizer can't close the loop | Organizer locks in a time; everyone gets an Add to calendar (.ics / Google) button |
| Banner ads, 2009 visual design | No ads, no tracking, Red Leg Dev branding, light and dark themes |

## Product scope

### PoC (this repo, now)
- Create a poll from the home page: name, specific dates (click or drag on a calendar) **or** days of the week, hour range, slot length (15 / 30 / 60), time zone. No account.
- Share link with copy and native share sheet.
- Join with a name. Device-scoped token; personal edit link to resume elsewhere.
- Paint availability: drag rectangles, Available / If needed brushes, tap a day header to fill or clear the column. Autosaves.
- Group heatmap with per-cell names, per-person filter, live refresh while the tab is visible.
- Best times: ranked windows with counts and missing names.
- Organizer link: lock in a time, remove a response, delete the poll. Final time exports as .ics and a Google Calendar link.
- Viewer-local time zone rendering with an event-zone toggle.
- Polls expire 60 days after their last day; expired rows are swept opportunistically on create.

### Next (Phase 1, before announcing it publicly)
- Turnstile on poll creation, Workers rate-limit binding on writes (abuse is the main cost risk on a free tool).
- Calendar overlay: drop in an .ics file or a public calendar URL and see busy blocks under the grid. Client-side parse, nothing stored.
- Dynamic OG image per poll (title + date range) so links unfurl well in iMessage and Slack.
- Optional email for the organizer: "everyone has responded" and lock-in confirmations via Cloudflare Email Sending.
- Accessibility pass: full keyboard painting (arrow keys + space), screen-reader table semantics, reduced-motion.
- Custom domain (e.g. `overlap.redleg.dev`) and a "Made by Red Leg Dev" footer link with UTM.

### Later (only if usage asks for it)
- Google / Microsoft calendar OAuth for auto-fill (adds secrets, consent screens, verification; skip until people ask).
- Recurring polls, ranked-choice "pick from these 3 times" mode.
- Self-host guide (it's already one Worker + one D1 database).

## Architecture

- **vinext 1.x** (Next.js App Router API on Vite) deployed to **Cloudflare Workers** via `cloudflare.config.ts`.
- **D1** with two tables. Raw SQL through the D1 binding, no ORM: the schema is small and an ORM is weight we'd carry for no gain.
- **No auth system.** A poll's id is a 10-character random slug (~60 bits). Participants and organizers get random 256-bit tokens; only SHA-256 hashes are stored.
- **Availability is one string per person**: one character per slot (`0` / `1` available / `2` if needed). A 7-day × 9-hour × 15-min poll is 252 bytes per person. Saving is one `UPDATE`.
- **Slots are defined in the event's time zone and indexed day-major.** The client turns each slot into a UTC instant and re-buckets the grid into the viewer's zone, so DST and cross-midnight conversions fall out of the same code path.
- **Live updates by polling** an `updated_at` version every 8s while the tab is visible; an unchanged poll costs one indexed read. Durable Objects + WebSockets would be nicer and aren't worth the cost or the `cf` CLI gaps yet.

### Data model

```
events(id, title, note, timezone, kind, days, start_min, end_min, slot_min,
       admin_hash, final_start, final_len, created_at, updated_at, expires_at)
responses(id, event_id, name, token_hash, slots, created_at, updated_at)
  unique(event_id, name collate nocase)
```

## Cost model (why it can be free)

Per poll with 8 respondents, roughly: 1 create write, 8 join writes, ~25 save writes, ~150 page/API reads, a few hundred polling reads that touch one row each.

- Workers Free: 100k requests/day. Workers Paid ($5/mo) includes 10M requests/month.
- D1 Paid includes 25B rows read / 50M rows written per month. A busy poll is well under 1,000 rows written.
- Storage: a poll with 20 people is a few KB. A million polls is single-digit GB before expiry sweeps.

At 10,000 polls a month this sits inside the $5 Workers Paid plan. The thing that breaks the model is abuse (scripted poll creation), which is why Turnstile + rate limiting lead Phase 1.

## Open source

MIT. Public repo under `RedLegDev/overlap`. Branding (name, Red Leg Dev mark) is not covered by the code license; forks should rebrand.

## Open decisions for Matt
1. **Name.** "Overlap" is a working name. Swap is a find-replace plus the Worker name.
2. **Domain.** `overlap.redleg.dev`, a standalone domain, or both.
3. **Analytics.** Cloudflare Web Analytics (cookie-free) is the only thing that fits "no tracking"; leave it off until there's a reason.
