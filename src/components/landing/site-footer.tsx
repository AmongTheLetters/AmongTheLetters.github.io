import { Wordmark } from "@/components/landing/wordmark";
import { NAV, SITE, SUBSTACK_URL } from "@/lib/site-content";

export function SiteFooter() {
  return (
    <footer className="border-t border-rule bg-paper py-12">
      <div className="section-shell flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
        <div>
          <Wordmark />
          <p className="mt-3 max-w-sm text-sm text-muted">{SITE.tagline}</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted transition-colors hover:text-ink"
            >
              {item.label}
            </a>
          ))}
          <a href={SUBSTACK_URL} target="_blank" rel="noreferrer" className="text-sm text-muted hover:text-ink">
            Substack
          </a>
          <a href="#faq" className="text-sm text-muted hover:text-ink">
            Questions
          </a>
        </nav>
      </div>
      <div className="section-shell mt-10 flex flex-col gap-2 border-t border-rule pt-6 text-sm text-faint md:flex-row md:justify-between">
        <p>© {new Date().getFullYear()} Among The Letters.</p>
        <p>A small literary briefing for writers, readers, and curious people.</p>
      </div>
    </footer>
  );
}
