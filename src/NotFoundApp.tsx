import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SubstackLink } from "@/components/landing/substack-link";
import { ARCHIVE_URL, RESOURCES_URL, SHOP_URL } from "@/lib/site-content";

const LINKS = [
  { href: "/", label: "Home", note: "What Among The Letters is and how the week works" },
  { href: ARCHIVE_URL, label: "The Archive", note: "Past Afternoon Discoveries editions, one for every day" },
  { href: RESOURCES_URL, label: "Free Resources", note: "Printable tools and a glossary for readers who write" },
  { href: SHOP_URL, label: "Shop", note: "Practical guides for readers who write" },
] as const;

export function NotFoundApp() {
  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <SiteHeader />
      <main className="py-20 md:py-28">
        <div className="section-shell max-w-3xl">
          <p className="kicker">Page not found</p>
          <h1 className="text-on-open mt-4 font-display text-masthead font-medium text-ink">This page has wandered off the shelf.</h1>
          <p className="text-on-open mt-5 max-w-2xl text-lead text-muted">
            The link may be old or mistyped. There is still plenty to read: every afternoon brings free stories, poems, and essays, with a different genre each day.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <SubstackLink label="Read today's edition on Substack" />
            <Button asChild variant="outline" size="lg">
              <a href={ARCHIVE_URL}>
                <span>Browse the archive</span>
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          </div>
          <h2 className="text-on-open mt-14 font-display text-2xl font-medium tracking-tight text-ink">Or try one of these</h2>
          <ul className="mt-5 divide-y divide-rule rounded-xl bg-cream shadow-[var(--shadow-border)]">
            {LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="flex items-baseline justify-between gap-4 px-6 py-4 hover:bg-paper">
                  <span className="font-display text-xl tracking-tight text-ink">{link.label}</span>
                  <span className="text-right text-sm text-muted">{link.note}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
