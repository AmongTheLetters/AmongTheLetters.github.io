import { ArrowUpRight } from "lucide-react";
import { AFTERNOON_SAMPLE, MORNING_SAMPLE, ROUNDUP_SAMPLE, SUBSTACK_URL } from "@/lib/site-content";

function Listing({ type, title, meta }: { type: string; title: string; meta: string }) {
  return (
    <li className="border-t border-rule py-3.5 first:border-t-0 first:pt-0">
      <p className="kicker">{type}</p>
      <p className="mt-1 font-display text-lg tracking-tight text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-muted">{meta}</p>
    </li>
  );
}

const editions = [
  {
    cadence: "Monday morning",
    title: "Morning Opportunities",
    deck: "A practical start to the week.",
    intro: "Work, contests, grants, residencies, and calls stay together here so the opportunity briefing remains clearly separate from the afternoon reading edition.",
    items: MORNING_SAMPLE,
    footer: "Regular editions use a useful free section followed by an expanded paid section.",
  },
  {
    cadence: "Every afternoon",
    title: "Afternoon Discoveries",
    deck: "A different kind of looking.",
    intro: "The afternoon belongs to literary discovery every day. The weekly genre rhythm keeps the shelf moving while leaving room for an exceptional find that deserves to cross the aisle.",
    items: AFTERNOON_SAMPLE,
    footer: "The paid portion adds more discoveries, deeper context, and Special Recommendations.",
  },
  {
    cadence: "Sunday evening · Paid subscribers",
    title: "Weekly Discoveries Roundup",
    deck: "The week's reading, gathered back together.",
    intro: "Sunday still has its regular Afternoon Discoveries edition. Later that evening, the roundup gives paid subscribers a concise path back through the week that just passed.",
    items: ROUNDUP_SAMPLE,
    footer: "The Sunday roundup is a complete paid-subscriber post rather than a free section followed by an internal paywall.",
  },
] as const;

export function SampleIssue() {
  return (
    <section className="border-t border-rule bg-cream py-20 md:py-28">
      <div className="section-shell">
        <div className="grid items-end gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            <p className="kicker">What arrives</p>
            <h2 className="mt-3 font-display text-masthead font-medium text-ink">
              Three editions. Three distinct jobs.
            </h2>
          </div>
          <p className="max-w-2xl text-lead text-muted lg:justify-self-end">
            Opportunities, discoveries, and the weekly catch-up each have their own place. The point is to know what you are opening before you open it, while keeping the whole week recognizably Among The Letters.
          </p>
        </div>

        <div className="mt-12 grid gap-6 xl:grid-cols-3">
          {editions.map((edition) => (
            <article key={edition.title} className="flex min-w-0 flex-col rounded-xl bg-paper p-6 shadow-[var(--shadow-border)] md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="kicker">{edition.cadence}</p>
                  <h3 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">{edition.title}</h3>
                  <p className="mt-1 text-sm text-faint">{edition.deck}</p>
                </div>
                <a
                  href={SUBSTACK_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-oxblood hover:underline"
                >
                  Substack <ArrowUpRight className="size-3.5" />
                </a>
              </div>

              <p className="mt-6 text-sm leading-relaxed text-muted">{edition.intro}</p>
              <ul className="mt-7">
                {edition.items.map((item) => (
                  <Listing key={item.title} {...item} />
                ))}
              </ul>

              <p className="mt-auto border-t border-rule pt-5 text-sm text-muted">{edition.footer}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
