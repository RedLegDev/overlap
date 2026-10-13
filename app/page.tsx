import { CreateForm } from "@/components/CreateForm";

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
              ["Free and open source.", "No ads, no tracking."],
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
        <section className="rise" style={{ animationDelay: "80ms" }}>
          <CreateForm />
        </section>
      </div>
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
