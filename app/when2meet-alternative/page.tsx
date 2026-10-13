import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { SITE } from "@/lib/site";

const TITLE = "Overlap vs. when2meet: a free when2meet alternative";
const DESCRIPTION =
  "Overlap is a free, open-source alternative to when2meet with no ads or cookies, an If needed option, ranked best times, and calendar export once a time is locked in.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/when2meet-alternative" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: `${SITE.url}/when2meet-alternative`, images: ["/og.png"] },
};

const ROWS: [string, string, string][] = [
  ["Price", "Free", "Free"],
  ["Ads", "Google AdSense ads", "None"],
  ["Analytics and ad tracking", "Google Analytics and Google Ads tags", "Self-hosted, cookie-free Plausible page counts; no ad tracking"],
  ["Account required", "No. Name, with an optional password", "No. The device remembers you; a personal link moves you to another one"],
  ["Marking availability", "Drag across a grid", "Drag across a grid, with Available and If needed brushes"],
  ["Time zones", "Detected from the browser, changeable", "Detected from the browser, changeable; the grid is re-laid out for each viewer"],
  ["Ranked best times", "No. Read the heatmap", "Yes, with who's missing from each window and a Must attend filter"],
  ["Lock in a final time", "No", "Yes. Everyone gets an .ics file or a Google Calendar link"],
  ["Open source", "No", "Yes, MIT license"],
];

export default function Page() {
  return (
    <article className="mx-auto max-w-4xl px-4 sm:px-6 pb-10 pt-6 sm:pt-12">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-redleg">Comparison</p>
      <h1 className="mt-2 font-serif text-5xl sm:text-6xl leading-[1] tracking-tight text-balance">
        A when2meet alternative without the ads
      </h1>
      <p className="mt-6 text-lg text-ink-2 text-pretty">
        Overlap does the same job as when2meet: one person proposes some days and hours, everyone marks when they&rsquo;re
        free, and the group sees where it overlaps. It&rsquo;s free, has no ads or ad tracking, and adds the parts when2meet
        leaves to you: an If needed option, a ranked list of the best times, and a way to lock in the final time and put
        it on everyone&rsquo;s calendar.
      </p>
      <p className="mt-3 text-[13px] text-muted">
        Compared against when2meet.com as of October 13, 2026.
      </p>

      <div className="mt-10 overflow-x-auto rounded-3xl border border-line bg-card">
        <table className="w-full text-left text-[15px]">
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className="p-4 font-semibold w-1/4">Feature</th>
              <th scope="col" className="p-4 font-semibold w-1/3 text-muted">when2meet</th>
              <th scope="col" className="p-4 font-semibold">Overlap</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line-2">
            {ROWS.map(([f, a, b]) => (
              <tr key={f} className="align-top">
                <th scope="row" className="p-4 font-medium">{f}</th>
                <td className="p-4 text-muted">{a}</td>
                <td className="p-4">{b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-14 space-y-10 text-[16px] leading-relaxed text-ink-2">
        <div>
          <h2 className="font-serif text-3xl text-ink">Is Overlap really free?</h2>
          <p className="mt-3">
            Yes. There are no plan tiers and no ads. Red Leg Dev runs Overlap on Cloudflare Workers with a single D1
            database. Each person&rsquo;s availability is stored as one short string, so saving a response is one database
            write and a poll costs a fraction of a cent to serve. The code is MIT-licensed if you&rsquo;d rather host your own.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-3xl text-ink">How do you pick a time in Overlap?</h2>
          <p className="mt-3">
            The Best times panel walks the grid in time order and groups each run of slots where the same people are
            free. It ranks those windows by how many can attend, counting If needed as half, and lists who&rsquo;s missing
            from each. Mark someone as Must attend to see only the windows that work for them. The organizer locks one in,
            and the poll shows everyone an Add to calendar button.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-3xl text-ink">Can people respond from a phone?</h2>
          <p className="mt-3">
            Yes. On a phone the poll shows one grid at a time, with tabs for your availability, the group, and the best
            times. Drag on the grid to mark times, or tap a day&rsquo;s header to fill the whole day.
          </p>
        </div>
        <div>
          <h2 className="font-serif text-3xl text-ink">When is when2meet still the better choice?</h2>
          <p className="mt-3">
            If your group already knows when2meet and the poll is a quick yes-or-no grid, it works fine. Overlap is the
            better fit when people are spread across time zones, when some times are possible but not ideal, or when you
            want the poll to end with a calendar invite instead of a screenshot of a heatmap.
          </p>
        </div>
      </section>

      <div className="mt-14 rounded-3xl bg-ink text-paper p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="font-serif text-3xl leading-tight">Start a poll in about a minute.</p>
        <a href="/" className="shrink-0 rounded-full bg-paper text-ink px-6 py-3 font-semibold hover:bg-paper-2 text-center">
          Create a poll
        </a>
      </div>

      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: TITLE,
          description: DESCRIPTION,
          url: `${SITE.url}/when2meet-alternative`,
          dateModified: "2026-10-13",
          about: { "@id": `${SITE.url}/#app` },
          publisher: { "@type": "Organization", name: SITE.publisher.name, url: SITE.publisher.url },
        }}
      />
    </article>
  );
}
