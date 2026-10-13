# Overlap

Free, open-source group scheduling. Pick some days, share one link, everyone paints when they're free. Overlap ranks the best times and shows who's missing from each.

No accounts, no ads, no cookies. Built by [Red Leg Dev](https://redleg.dev).

- Drag-to-paint that works on phones
- Available and If needed brushes
- Every viewer sees the grid in their own time zone
- Ranked best times with "must attend" filters
- Organizer locks in a time, everyone adds it to their calendar (.ics / Google)

Scope, architecture, and cost model: [docs/SCOPE.md](docs/SCOPE.md).

## Stack

[vinext](https://github.com/cloudflare/vinext) (Next.js App Router on Vite) on Cloudflare Workers, with one D1 database. No ORM, no auth provider, no external services.

## Develop

```bash
npm install
npm run db:migrate:local   # local D1 under .cloudflare/state
npm run dev
```

## Deploy

```bash
npm run db:migrate:remote
npm run deploy             # vinext-cloudflare deploy, config in cloudflare.config.ts
```

To self-host, create your own D1 database (`wrangler d1 create overlap`) and replace `accountId` and the D1 `id` in `cloudflare.config.ts` and `wrangler.jsonc`.

## License

MIT for the code. The Overlap name and Red Leg Dev marks aren't covered by the license; rebrand forks you host publicly.
