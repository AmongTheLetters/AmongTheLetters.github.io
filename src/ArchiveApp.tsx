import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarDays, FileText, LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SubstackLink } from "@/components/landing/substack-link";
import { ARCHIVE_ISSUES, EDITION_DESCRIPTIONS, type ArchiveIssue } from "@/lib/archive-content";

type EditionFilter = "All editions" | ArchiveIssue["edition"];

function readableDate(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function IssueCard({ issue }: { issue: ArchiveIssue }) {
  return (
    <a
      href={issue.pdf}
      target="_blank"
      rel="noreferrer"
      className="group flex min-h-72 flex-col rounded-xl bg-cream p-6 shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] hover:-translate-y-1 hover:shadow-[var(--shadow-border-hover)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxblood md:p-7"
      aria-label={`Open ${issue.edition} from ${readableDate(issue.date)} as a PDF`}
    >
      <div className="flex items-start justify-between gap-4">
        <p className="kicker">{issue.edition}</p>
        <span className="rounded-md border border-rule bg-paper p-2 text-oxblood" aria-hidden="true">
          <FileText className="size-4" strokeWidth={1.75} />
        </span>
      </div>

      <div className="mt-8">
        <p className="font-display text-3xl font-medium tracking-tight text-ink">
          {readableDate(issue.date)}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          {EDITION_DESCRIPTIONS[issue.edition]}
        </p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-4 border-t border-rule pt-5 text-sm font-medium text-ink">
        <span>Open the PDF</span>
        <ArrowUpRight className="size-4 text-oxblood transition-transform duration-[var(--motion-quick)] group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </a>
  );
}

export function ArchiveApp() {
  const editions = useMemo(
    () => Array.from(new Set(ARCHIVE_ISSUES.map((issue) => issue.edition))),
    [],
  );
  const [filter, setFilter] = useState<EditionFilter>("All editions");

  const visibleIssues = useMemo(
    () => filter === "All editions" ? ARCHIVE_ISSUES : ARCHIVE_ISSUES.filter((issue) => issue.edition === filter),
    [filter],
  );

  const groups = useMemo(() => {
    const grouped = new Map<string, ArchiveIssue[]>();
    visibleIssues.forEach((issue) => {
      const label = monthLabel(issue.date);
      const current = grouped.get(label) ?? [];
      current.push(issue);
      grouped.set(label, current);
    });
    return Array.from(grouped.entries());
  }, [visibleIssues]);

  const latest = ARCHIVE_ISSUES[0];

  return (
    <div id="top" className="relative min-h-dvh bg-paper text-ink">
      <a href="#issues" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">
        Skip to published issues
      </a>
      <SiteHeader />

      <main>
        <section className="border-b border-rule pb-16 pt-12 md:pb-24 md:pt-20">
          <div className="section-shell">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-end">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 text-oxblood">
                  <LibraryBig className="size-5" strokeWidth={1.75} />
                  <p className="kicker">The archive</p>
                </div>
                <h1 className="mt-4 font-display text-masthead font-medium text-ink md:max-w-2xl">
                  Past letters, kept within reach.
                </h1>
                <p className="mt-5 max-w-2xl text-lead text-muted">
                  A growing shelf of published Among The Letters editions. Choose an issue below to open the original PDF and read it as it appeared.
                </p>
              </div>

              <div className="rounded-xl bg-cream p-6 shadow-[var(--shadow-border)] md:p-7">
                <div className="flex items-center gap-2 text-muted">
                  <CalendarDays className="size-4" strokeWidth={1.75} />
                  <p className="text-sm font-medium">Newest in the archive</p>
                </div>
                {latest ? (
                  <>
                    <p className="mt-4 font-display text-2xl tracking-tight text-ink">{latest.edition}</p>
                    <p className="mt-1 text-sm text-muted">{readableDate(latest.date)}</p>
                    <Button asChild className="mt-6 w-full">
                      <a href={latest.pdf} target="_blank" rel="noreferrer">
                        Open newest PDF <ArrowUpRight className="size-4" />
                      </a>
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section id="issues" className="scroll-mt-28 py-20 md:py-28">
          <div className="section-shell">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="kicker">Published issues</p>
                <h2 className="mt-3 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
                  Open whichever letter you were looking for.
                </h2>
                <p className="mt-4 max-w-xl text-muted">
                  PDFs open in a new tab, so you can keep your place here while you read. Only editions intentionally added to the public archive appear on this page.
                </p>
              </div>
              <p className="text-sm text-faint">
                {ARCHIVE_ISSUES.length} {ARCHIVE_ISSUES.length === 1 ? "issue" : "issues"} currently shelved
              </p>
            </div>

            {editions.length > 1 ? (
              <div className="mt-10 flex flex-wrap gap-2" aria-label="Filter archive by edition">
                {["All editions", ...editions].map((edition) => {
                  const active = filter === edition;
                  return (
                    <button
                      key={edition}
                      type="button"
                      onClick={() => setFilter(edition as EditionFilter)}
                      className={active
                        ? "rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment"
                        : "rounded-full border border-rule bg-cream px-4 py-2 text-sm font-medium text-muted transition-colors hover:border-rule-strong hover:text-ink"}
                      aria-pressed={active}
                    >
                      {edition}
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div className="mt-12 space-y-14">
              {groups.map(([month, issues]) => (
                <section key={month} aria-labelledby={`month-${month.replace(/\s+/g, "-").toLowerCase()}`}>
                  <div className="flex items-center gap-4">
                    <h3 id={`month-${month.replace(/\s+/g, "-").toLowerCase()}`} className="font-display text-2xl font-medium tracking-tight text-ink">
                      {month}
                    </h3>
                    <span className="rule flex-1" aria-hidden="true" />
                  </div>
                  <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                    {issues.map((issue) => <IssueCard key={issue.slug} issue={issue} />)}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-rule bg-ink py-16 text-parchment md:py-20">
          <div className="section-shell flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="kicker kicker-inverse">The current letters</p>
              <h2 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
                The archive keeps the trail. Substack carries the next issue.
              </h2>
              <p className="mt-4 max-w-xl text-parchment/70">
                Visit the newsletter for current editions, subscriptions, and whatever has just arrived.
              </p>
            </div>
            <SubstackLink label="Visit Among The Letters on Substack" invert />
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
