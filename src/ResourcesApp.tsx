import { ArrowUpRight, Download, Gift, Printer, Library, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SubstackLink } from "@/components/landing/substack-link";
import {
  RESOURCE_CATEGORIES,
  RESOURCE_IMAGE_BASE,
  RESOURCE_PRINCIPLES,
  type Resource,
} from "@/lib/resources-content";
import { SHOP_URL } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const PRINCIPLE_ICONS = [Gift, Printer, FileCheck2] as const;
const CATEGORIES = RESOURCE_CATEGORIES.filter((category) => category.items.length > 0);

function ResourceCard({ resource }: { resource: Resource }) {
  const primary = resource.files[0];
  const extras = resource.files.slice(1);
  const headingId = `${resource.id}-heading`;
  return (
    <article
      id={resource.id}
      aria-labelledby={headingId}
      className="relative flex scroll-mt-28 flex-col overflow-hidden rounded-xl bg-cream shadow-[var(--shadow-border)]"
    >
      <span className="absolute inset-x-0 top-0 z-10 h-1 bg-oxblood" aria-hidden="true" />
      <a
        href={primary.href}
        target="_blank"
        rel="noopener"
        className="group block border-b border-rule bg-paper p-5 focus-visible:outline-2 focus-visible:-outline-offset-4 focus-visible:outline-oxblood sm:p-6"
        aria-label={`Open ${resource.title} (${primary.label}, opens in a new tab)`}
      >
        <span className="flex aspect-[4/3] items-center justify-center">
          <img
            src={`${RESOURCE_IMAGE_BASE}/${resource.slug}-480.webp`}
            srcSet={`${RESOURCE_IMAGE_BASE}/${resource.slug}-480.webp 480w, ${RESOURCE_IMAGE_BASE}/${resource.slug}-960.webp 960w`}
            sizes="(min-width: 1024px) 340px, (min-width: 640px) 45vw, 90vw"
            alt={resource.alt}
            width={resource.orientation === "landscape" ? 960 : 742}
            height={resource.orientation === "landscape" ? 742 : 960}
            loading="lazy"
            decoding="async"
            className={cn(
              "max-h-full w-auto rounded-sm bg-white object-contain shadow-[0_1px_2px_rgb(26_22_18/0.08),0_14px_30px_-16px_rgb(26_22_18/0.45)] transition-transform duration-[var(--motion-fast)] ease-[var(--ease-out)] group-hover:-translate-y-0.5",
              resource.orientation === "landscape" ? "max-w-full" : "h-full",
            )}
          />
        </span>
      </a>
      <div className="flex flex-1 flex-col p-6">
        <p className="kicker">{resource.pages}</p>
        <h3 id={headingId} className="mt-2 font-display text-2xl font-medium tracking-tight text-ink">
          {resource.title}
        </h3>
        <p className="mt-2 flex-1 leading-relaxed text-muted">{resource.description}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button asChild>
            <a href={primary.href} download aria-label={`Download ${resource.title} as a ${primary.label}`}>
              <Download className="size-4" aria-hidden="true" />
              <span>Download {primary.label}</span>
            </a>
          </Button>
          {extras.map((file) => (
            <Button key={file.href} asChild variant="outline">
              <a href={file.href} download aria-label={`Download ${resource.title} as an editable ${file.label} file`}>
                <Download className="size-4" aria-hidden="true" />
                <span>{file.label}</span>
              </a>
            </Button>
          ))}
        </div>
      </div>
    </article>
  );
}

export function ResourcesApp() {
  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#library" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">
        Skip to the library
      </a>
      <SiteHeader />

      <main>
        <section className="border-b border-rule pb-16 pt-12 md:pb-24 md:pt-20">
          <div className="section-shell">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-end">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 text-oxblood">
                  <Library className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  <p className="kicker">Among The Letters</p>
                </div>
                <h1 className="text-on-open mt-4 font-display text-masthead font-medium text-ink">Free Resources</h1>
                <p className="text-on-open mt-4 max-w-2xl text-balance font-display text-deck leading-snug tracking-tight text-ink">
                  A small, growing library for writers.
                </p>
                <p className="text-on-open mt-5 max-w-2xl text-lead text-muted">
                  Practical, printable pieces to make the business side of writing a little lighter. Free to download, free to keep, and made with the same care as everything else here.
                </p>
              </div>

              <aside aria-labelledby="library-notes-heading" className="rounded-xl border border-bark/25 bg-cream p-6 shadow-[var(--shadow-border)] md:p-7">
                <h2 id="library-notes-heading" className="font-sans text-sm font-medium tracking-normal text-muted">
                  How the library works
                </h2>
                <ul className="mt-5 space-y-5">
                  {RESOURCE_PRINCIPLES.map((item, index) => {
                    const Icon = PRINCIPLE_ICONS[index];
                    return (
                      <li key={item.title} className="flex gap-4">
                        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-rule bg-paper text-oxblood" aria-hidden="true">
                          <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-lg font-medium leading-snug tracking-tight text-ink">{item.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </div>

            {CATEGORIES.length > 1 ? (
              <nav aria-label="Library sections" className="mt-12 flex flex-wrap gap-3">
                {CATEGORIES.map((category) => (
                  <a key={category.id} href={`#${category.id}`} className="rounded-full border border-rule bg-cream px-4 py-2 text-sm font-medium text-muted hover:text-ink">
                    {category.kicker}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
        </section>

        <div id="library">
          {CATEGORIES.map((category) => (
            <section
              key={category.id}
              id={category.id}
              aria-labelledby={`${category.id}-title`}
              className="scroll-mt-28 py-20 md:py-28"
            >
              <div className="section-shell">
                <div className="max-w-2xl">
                  <p className="kicker">{category.kicker}</p>
                  <h2 id={`${category.id}-title`} className="text-on-open mt-3 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
                    {category.title}
                  </h2>
                  <p className="text-on-open mt-4 max-w-xl text-muted">{category.intro}</p>
                </div>
                <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                  {category.items.map((resource) => (
                    <ResourceCard key={resource.id} resource={resource} />
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>

        <section aria-labelledby="go-further-heading" className="border-t border-rule py-16 md:py-20">
          <div className="section-shell grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
            <div className="max-w-2xl">
              <p className="kicker">Going further</p>
              <h2 id="go-further-heading" className="text-on-open mt-3 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
                Want the whole system?
              </h2>
              <p className="text-on-open mt-4 max-w-xl text-muted">
                These tools come from the same desk as The Submission Desk, our guide to preparing, sending, and tracking your writing, with twelve templates and a full tracker spreadsheet that counts your waiting days for you.
              </p>
              <p className="text-on-open mt-4 text-sm italic text-faint">More free resources, including a plain-language glossary, are on the way.</p>
            </div>
            <Button asChild variant="outline" size="lg">
              <a href={`${SHOP_URL}#submission-desk`}>
                <span>See The Submission Desk</span>
                <ArrowUpRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
        </section>

        <section className="border-t border-rule bg-ink py-16 text-parchment md:py-20">
          <div className="section-shell flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="kicker kicker-inverse">The newsletter</p>
              <h2 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
                Somewhere to send your work, every Monday.
              </h2>
              <p className="mt-4 max-w-xl text-parchment/70">
                Morning Opportunities gathers checked calls for submissions, contests, grants, and residencies each week, with a free edition on Substack.
              </p>
            </div>
            <div className="flex w-full min-w-0 justify-center md:w-auto md:shrink-0 md:justify-end">
              <SubstackLink
                label="Read Among The Letters on Substack"
                invert
                className="h-auto min-h-11 w-full max-w-full whitespace-normal px-4 py-3 text-center text-sm sm:w-auto"
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
