import { SubstackLink } from "@/components/landing/substack-link";
import { SITE } from "@/lib/site-content";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-12">
      <div className="section-shell">
        <div className="stagger-in mx-auto max-w-4xl text-center">
          <div className="flex items-center gap-4"><span className="rule flex-1" /><p className="kicker shrink-0 text-ink/70">{SITE.kicker}</p><span className="rule flex-1" /></div>
          <h1 className="mt-6 font-display text-display font-medium tracking-tight text-ink"><span className="italic">Among</span> the Letters</h1>
          <div className="mx-auto mt-5 max-w-2xl"><div className="rule-double" /></div>
          <p className="mx-auto mt-8 max-w-2xl font-display text-deck font-normal leading-snug tracking-tight text-ink">Find useful opportunities.<br className="hidden sm:block" /> Discover worthwhile writing.</p>
          <p className="mx-auto mt-5 max-w-xl text-lead text-muted">A gathering place for writers, readers, and curious people. Come for the opportunities, stay for the books, essays, authors, stories, and strange little things worth finding along the way.</p>
          <div className="mx-auto mt-8 flex justify-center"><SubstackLink label="Wander over to Substack" /></div>
          <p className="mt-5 text-sm text-muted">Morning Opportunities on Mondays and Thursdays <span className="mx-2 text-rule-strong">·</span> Afternoon Discoveries every day</p>
        </div>
        <figure className="mt-12 md:mt-16">
          <img src="./images/hero.jpg" alt="A writer's desk with an open book, fountain pen, letters, and coffee in window light." className="img-frame aspect-video w-full rounded-2xl object-cover md:aspect-hero" width={1792} height={1008} />
          <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-faint"><span>There may be something waiting for you</span><span className="hidden font-medium uppercase tracking-kicker text-oxblood sm:inline">Among the Letters</span></figcaption>
        </figure>
      </div>
    </section>
  );
}
