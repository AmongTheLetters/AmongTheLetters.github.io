import { CalendarFold, Sunrise, Sunset } from "lucide-react";

const editions = [
  {
    icon: Sunrise,
    cadence: "Monday morning",
    title: "Morning Opportunities",
    body: "A checked gathering of writing and editorial work, contests, grants, fellowships, residencies, calls for submissions, and other places your work might go next.",
    note: "The free portion is useful on its own. Paid subscribers get a larger field of listings, featured opportunities, and added context.",
    inverse: false,
  },
  {
    icon: Sunset,
    cadence: "Every afternoon",
    title: "Afternoon Discoveries",
    body: "Books, authors, essays, stories, poems, magazines, projects, and worthwhile literary work, with a different corner of the bookshelf in view each day.",
    note: "Each regular edition begins with a complete free section, then expands for paid subscribers with more discoveries and Special Recommendations.",
    inverse: true,
  },
  {
    icon: CalendarFold,
    cadence: "Sunday evening · Paid subscribers",
    title: "Weekly Discoveries Roundup",
    body: "A compact catch-up that arrives after Sunday's regular Afternoon Discoveries, gathering the week's Featured Discoveries and useful links back into one place.",
    note: "When useful, Sunday can also bring back a small handful of Monday opportunities that are still timely enough to act on.",
    inverse: false,
  },
] as const;

export function Briefing() {
  return (
    <section id="briefing" className="scroll-mt-28 py-20 md:py-28">
      <div className="section-shell">
        <div className="max-w-2xl">
          <p className="kicker">What you'll find</p>
          <h2 className="mt-3 font-display text-masthead font-medium text-ink">
            One publication, three ways to find something worth your time.
          </h2>
          <p className="mt-4 max-w-xl text-lead text-muted">
            Monday begins with somewhere your work might go. Every afternoon turns toward reading. On Sunday evening, paid subscribers get the week gathered back together too.
          </p>
        </div>

        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          {editions.map((edition) => {
            const Icon = edition.icon;
            return (
              <article
                key={edition.title}
                className={edition.inverse
                  ? "rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)] md:p-8"
                  : "rounded-xl bg-cream p-6 shadow-[var(--shadow-border)] md:p-8"}
              >
                <div className={edition.inverse ? "flex items-center gap-3 text-parchment/70" : "flex items-center gap-3 text-oxblood"}>
                  <Icon className="size-5" />
                  <p className={edition.inverse ? "kicker kicker-inverse" : "kicker"}>{edition.cadence}</p>
                </div>
                <h3 className="mt-4 font-display text-3xl font-medium tracking-tight">
                  {edition.title}
                </h3>
                <p className={edition.inverse ? "mt-3 text-parchment/75" : "mt-3 text-muted"}>
                  {edition.body}
                </p>
                <p className={edition.inverse
                  ? "mt-8 rounded-lg bg-parchment/8 px-4 py-4 text-sm text-parchment/70"
                  : "mt-8 rounded-lg bg-paper px-4 py-4 text-sm text-muted"}
                >
                  {edition.note}
                </p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
