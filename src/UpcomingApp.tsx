import { ArrowUpRight, CalendarDays, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { FEATURED, downloadName } from "@/components/landing/featured";
import { formatLive, upcomingFeatures, yearByMonth } from "@/lib/featured-schedule";

export function UpcomingApp() {
  const next = upcomingFeatures(6);
  const year = yearByMonth();
  const f = FEATURED;

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#schedule" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">
        Skip to the schedule
      </a>
      <SiteHeader />

      <main>
        <section className="border-b border-rule pb-16 pt-12 md:pb-20 md:pt-20">
          <div className="section-shell grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-end">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-oxblood">
                <CalendarDays className="size-5" strokeWidth={1.75} />
                <p className="kicker">Upcoming featured</p>
              </div>
              <h1 className="text-on-open mt-4 font-display text-masthead font-medium text-ink md:max-w-2xl">
                What is coming to the featured shelf.
              </h1>
              <p className="text-on-open mt-5 max-w-2xl text-lead text-muted">
                Every few weeks <em>Among The Letters</em> shares a free featured piece, written for the holidays and seasons of the year ahead. Holiday pieces arrive about a week before the day, so there is time to read and share them.
              </p>
            </div>

            <div className="rounded-xl border border-bark/25 bg-cream p-6 shadow-[var(--shadow-border)] md:p-7">
              <p className="text-sm font-medium text-muted">Featured now · {f.date}</p>
              <p className="mt-3 font-display text-2xl tracking-tight text-ink">{f.title}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
                <Button asChild className="flex-1">
                  <a href={f.pdf} target="_blank" rel="noopener">Read the piece <ArrowUpRight className="size-4" /></a>
                </Button>
                <Button asChild variant="outline" className="flex-1">
                  <a href={f.pdf} download={downloadName(f)}>Download PDF <Download className="size-4" /></a>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section id="schedule" className="scroll-mt-28 py-16 md:py-24">
          <div className="section-shell">
            <p className="kicker">Coming next</p>
            <h2 className="text-on-open mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">The next few pieces</h2>
            <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {next.map((item) => {
                const d = formatLive(item.live);
                return (
                  <li key={item.live} className="flex min-h-52 flex-col rounded-xl bg-cream p-6 shadow-[var(--shadow-border)] md:p-7">
                    <p className="kicker">{item.occasion}</p>
                    <p className="mt-6 font-display text-3xl font-medium tracking-tight text-ink">{d.month} {d.day}, {d.year}</p>
                    <p className="mt-1 text-sm text-muted">{d.weekday}</p>
                    <div className="mt-auto border-t border-rule pt-5">
                      <p className={item.confirmed ? "font-display text-lg leading-snug text-ink" : "font-display text-lg italic leading-snug text-faint"}>
                        {item.confirmed ? item.title : "Title coming soon"}
                      </p>
                      {item.list ? <p className="mt-1 text-sm text-muted">A larger list feature</p> : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section aria-labelledby="year-heading" className="border-t border-rule py-16 md:py-24">
          <div className="section-shell">
            <p className="kicker">The year ahead</p>
            <h2 id="year-heading" className="text-on-open mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">Month by month</h2>
            <p className="text-on-open mt-4 max-w-xl text-muted">Occasions we are planning for, with titles shared closer to each date.</p>
            <dl className="mt-10 grid gap-x-12 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {year.map((g) => (
                <div key={g.label} className="border-t border-rule pt-4">
                  <dt className="font-display text-xl font-medium tracking-tight text-ink">{g.label}</dt>
                  <dd className="mt-2 text-muted">{g.occasions.join(", ")}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <FlierPopup />
    </div>
  );
}
