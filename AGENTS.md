# Overlap — agent notes

Free, open-source group availability poll (when2meet replacement) at https://overlap.redleg.dev. Product scope and decisions: `docs/SCOPE.md`.

## Stack
- vinext 1.x (Next.js App Router API on Vite 8), React 19, Tailwind v4, deployed as one Cloudflare Worker with one D1 database.
- Bindings are declared in `cloudflare.config.ts` and typed in `types.d.ts`. Read them with `import { env } from "cloudflare:workers"`.
- Raw SQL against D1 (`lib/server.ts` → `db()`). No ORM. Migrations in `migrations/`.

## Commands
- `npm run dev`: local dev server. D1 state lives in `.cloudflare/state`.
- `npm run db:migrate:local`: apply migrations to the local D1 (run once before dev).
- `npm run typecheck` and `npm run build` are the gates. Both must pass before pushing.
- **Deploys:** Workers Builds deploys every push to `main`. Never run `npm run deploy` or `wrangler deploy` by hand.

## How it works
- Slots are indexed day-major in the event's time zone. `lib/time.ts` turns them into UTC instants and re-lays the grid out in the viewer's zone (`layoutGrid`). Availability is one string per person: `0`, `1` (available), `2` (if needed).
- `lib/best.ts` ranks contiguous windows for the Best times panel.
- No accounts. Poll ids are random slugs. Organizer and participant tokens are 256-bit random values; only SHA-256 hashes are stored. Tokens travel in the URL **hash** (`#admin=…`, `#me=…`) and in localStorage `overlap:<id>`.
- Turnstile guards poll creation and is skipped on localhost only. Workers rate-limit bindings guard writes.

## Rules
- Never put a poll id or token anywhere that leaves the page: analytics, logs, error messages, third-party URLs. `components/Analytics.tsx` redacts `/e/<id>` to `/e/:id` and drops the hash; keep it that way.
- Poll pages (`/e/*`) are `noindex` and disallowed in robots.txt.
- No new runtime dependencies without a clear reason; the Worker should stay small.
- UI copy: plain and direct. No exclamation marks, no cheerleading, no explaining the mechanism ("we use…"). No HTTP status codes in user-facing text.
- Mobile first: check every UI change at 390px wide as well as desktop. The grid uses pointer events with `touch-none` cells.
- Commit messages: imperative subject, `refs #N` in the subject for issue work.
