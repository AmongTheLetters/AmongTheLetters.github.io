import { Button } from "@/components/ui/button";
import { SubstackLink } from "@/components/landing/substack-link";
import { ARCHIVE_URL, SITE } from "@/lib/site-content";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-0 pt-8 md:pt-12">
      <div className="section-shell">
        <div className="stagger-in mx-auto max-w-4xl text-center">
          <div className="rule-floral" aria-hidden="true">
            <span className="rule-floral-mark"><span /></span>
          </div>
          <p className="text-on-open mt-4 kicker shrink-0 text-bark">{SITE.kicker}</p>

          <h1 className="text-on-open mt-6 font-display text-display font-medium tracking-tight text-ink">
            <span className="italic">Among The Letters</span>
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
        </div>

      </div>
    </section>
  );
}
