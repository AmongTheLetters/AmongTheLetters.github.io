import { Button } from "@/components/ui/button";
import { SubstackLink } from "@/components/landing/substack-link";
import { ARCHIVE_URL, SITE } from "@/lib/site-content";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-8 md:pb-24 md:pt-12">
      <div className="section-shell">
        <div className="stagger-in mx-auto max-w-4xl text-center">
          <div className="rule-floral" aria-hidden="true">
            <span className="rule-floral-mark"><span /></span>
          </div>
          <p className="text-on-open mt-4 kicker shrink-0 text-bark">{SITE.kicker}</p>

          <h1 className="text-on-open mt-6 font-display text-display font-medium tracking-tight text-ink">
            <span className="italic">Among</span> the Letters
          </h1>

          <div className="mx-auto mt-5 max-w-2xl"><div className="rule-double" /></div>

          <p className="text-on-open mx-auto mt-8 max-w-2xl font-display text-deck font-normal leading-snug tracking-tight text-ink">
            Stories, poems, and essays worth your afternoon.
            <br className="hidden sm:block" /> A different genre every day.
          </p>

          <div className="mx-auto mt-6 flex justify-center">
            <Button asChild variant="outline" size="lg">
              <a href={ARCHIVE_URL}>Browse the archive</a>
            </Button>
          </div>

          <p className="text-on-open mx-auto mt-5 max-w-xl text-lead text-muted">
            Free reading, picked by hand and checked daily, for anyone who loves a good story. Come for the stories, poems, and essays, and stay for the books, authors, and strange little things worth finding along the way. Readers who write will find opportunities and free tools here too.
          </p>

          <div className="mx-auto mt-8 flex justify-center">
            <SubstackLink label="Wander over to Substack" />
          </div>

          <p className="text-on-open mx-auto mt-5 max-w-2xl text-sm text-muted">
            Afternoon Discoveries every day
            <span className="mx-2 text-rule-strong">·</span>
            Sunday evening roundup for paid subscribers
            <span className="mx-2 text-rule-strong">·</span>
            Writing opportunities on Mondays
          </p>

          <p className="text-on-open mx-auto mt-4 max-w-xl text-sm">
            <a
              href="mailto:amongtheletters@gmail.com?subject=Founding%20Lifetime%20Membership%20Inquiry"
              className="font-medium text-oxblood transition-colors hover:text-oxblood-dark hover:underline hover:underline-offset-4"
            >
              Founding lifetime memberships are available for $299 CAD.
              <br />
              Lifetime paid newsletter access, plus select future Among The Letters releases outside Substack.
              <br />
              Email amongtheletters@gmail.com for details.
            </a>
          </p>
        </div>

        <figure className="mt-12 md:mt-16">
          <img
            src="/images/hero.webp"
            fetchPriority="high"
            decoding="async"
            alt="An open book, a fountain pen, letters, and a cup of coffee on a desk in window light."
            className="img-frame aspect-video w-full rounded-2xl object-cover md:aspect-hero"
            width={1083}
            height={419}
          />
          <figcaption className="mt-3 flex items-center justify-between gap-4 text-sm text-faint">
            <span>There may be something waiting for you</span>
            <span className="hidden font-medium tracking-kicker text-oxblood sm:inline">Among the Letters</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
