import { env } from "cloudflare:workers";
import { CreateForm } from "@/components/CreateForm";
import { JsonLd } from "@/components/JsonLd";
import { FAQ, SITE } from "@/lib/site";

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-10">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,620px)] gap-10 lg:gap-16 items-start pt-6 sm:pt-12">
        <section className="lg:sticky lg:top-10 rise">
          <h1 className="font-serif text-[3.25rem] sm:text-7xl leading-[0.95] tracking-tight text-balance">
            Find the time <em className="text-redleg">everyone</em> can make.
          </h1>
          <p className="mt-6 text-lg text-ink-2 max-w-md text-pretty">
            Pick some days. Share one link. Everyone paints when they&rsquo;re free, on any device, in their own
            time zone. Overlap shows you the best times.
          </p>
          <ul className="mt-8 grid gap-3 text-[15px] text-ink-2 max-w-md">
            {[
              ["No accounts", "for you or anyone you invite."],
              ["Drag to paint", "on a phone or a laptop. Mark maybes separately."],
              ["Best times, ranked", "with who's missing from each."],
              ["Free and open source.", "No ads, no cookies."],
            ].map(([a, b]) => (
              <li key={a} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-redleg" />
                <span>
                  <strong className="font-semibold text-ink">{a}</strong> {b}
                </span>
              </li>
            ))}
          </ul>
          <HeroPreview />
        </section>
        <section className="rise" style={{ animationDelay: "80ms" }} aria-label="Create a poll">
          <CreateForm siteKey={env.TURNSTILE_SITE_KEY} />
        </section>
      </div>

      <section className="mt-24 sm:mt-32" aria-labelledby="how">
        <h2 id="how" className="font-serif text-4xl sm:text-5xl tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {[
            ["Pick the window", "Choose specific dates or days of the week, the hours to consider, and 15, 30 or 60 minute slots."],
            ["Share one link", "Send it to the group however you already talk. People type a name and drag across the times they're free."],
            ["Lock in a time", "Best times ranks the windows most people can make and names who's missing. Lock one in and everyone can add it to their calendar."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-3xl border border-line bg-card p-6">
              <span className="font-serif text-3xl text-redleg">{i + 1}</span>
              <h3 className="mt-2 text-lg font-semibold">{t}</h3>
              <p className="mt-2 text-[15px] text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-24 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]" aria-labelledby="faq">
        <div>
          <h2 id="faq" className="font-serif text-4xl sm:text-5xl tracking-tight">Questions</h2>
          <p className="mt-4 text-ink-2">
            Coming from when2meet? See{" "}
            <a href="/when2meet-alternative" className="underline decoration-line underline-offset-4 hover:text-ink">
              how Overlap compares
            </a>
            .
          </p>
        </div>
        <dl className="divide-y divide-line border-y border-line">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="py-5">
              <dt className="text-lg font-semibold">{q}</dt>
              <dd className="mt-2 text-[15px] leading-relaxed text-ink-2">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebApplication",
              "@id": `${SITE.url}/#app`,
              name: SITE.name,
              url: SITE.url,
              description: SITE.description,
              applicationCategory: "BusinessApplication",
              applicationSubCategory: "Group scheduling",
              operatingSystem: "Any (web browser)",
              browserRequirements: "Requires JavaScript",
              isAccessibleForFree: true,
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              license: "https://opensource.org/licenses/MIT",
              codeRepository: SITE.repo,
              image: `${SITE.url}/og.png`,
              publisher: { "@id": `${SITE.publisher.url}/#organization` },
            },
            {
              "@type": "Organization",
              "@id": `${SITE.publisher.url}/#organization`,
              name: SITE.publisher.name,
              url: SITE.publisher.url,
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQ.map(({ q, a }) => ({
                "@type": "Question",
                name: q,
                acceptedAnswer: { "@type": "Answer", text: a },
              })),
            },
          ],
        }}
      />
    </div>
  );
}

// A small static heatmap so the page shows what the product does.
function HeroPreview() {
  const data = [
    "0012332100",
    "0123443210",
    "0013454310",
    "0002343200",
    "0001232100",
  ];
  return (
    <div aria-hidden="true" className="mt-10 hidden lg:flex gap-1.5">
      {data.map((col, c) => (
        <div key={c} className="flex flex-col gap-1">
          {col.split("").map((v, r) => (
            <span
              key={r}
              className="h-3.5 w-10 rounded-[3px]"
              style={{
                background: Number(v)
                  ? `rgb(var(--yes) / ${0.12 + (Number(v) / 5) * 0.88})`
                  : "var(--paper-2)",
                outline: c === 2 && (r === 4 || r === 5) ? "2px solid var(--redleg)" : undefined,
                outlineOffset: c === 2 && (r === 4 || r === 5) ? "1px" : undefined,
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
