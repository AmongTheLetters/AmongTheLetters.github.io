import { SAMPLE_DISCOVERIES, SAMPLE_JOBS, SAMPLE_OPPS } from "@/lib/site-content";

function Listing({
  type,
  title,
  meta,
}: {
  type: string;
  title: string;
  meta: string;
}) {
  return (
    <li className="border-t border-rule py-3.5 first:border-t-0 first:pt-0">
      <p className="kicker">{type}</p>
      <p className="mt-1 font-display text-lg tracking-tight text-ink">{title}</p>
      <p className="mt-0.5 text-sm text-muted">{meta}</p>
    </li>
  );
}

export function SampleIssue() {
  return (
    <section className="border-t border-rule bg-cream py-20 md:py-28">
      <div className="section-shell grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <div>
          <p className="kicker">What arrives</p>
          <h2 className="mt-3 font-display text-masthead font-medium text-ink">
            A useful place to begin.
          </h2>
          <p className="mt-4 text-lead text-muted">
            Opportunity editions bring the practical details forward, then point you to the original source. Discovery editions are looser by nature, with room for a recommendation, an emerging voice, or something unexpected. These examples show the shape of the publication, not live listings.
          </p>
          <figure className="mt-8">
            <img
              src="./images/pen.jpg"
              alt="A fountain pen nib touching cream paper, a drop of ink at the tip."
              className="img-frame aspect-video w-full rounded-xl object-cover"
              width={1728}
              height={1152}
            />
          </figure>
        </div>

        <div className="rounded-xl bg-paper p-6 shadow-[var(--shadow-border)] md:p-8">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-display text-2xl tracking-tight text-ink">
              Morning Opportunities
            </p>
            <a
               href="https://amongtheletters.substack.com/"
              target="_blank"
               rel="noreferrer"
               className="text-sm text-muted transition-colors hover:text-oxblood hover:underline"
               >
              Read on Substack
            </a>
          </div>
          <p className="mt-1 text-sm text-faint">A way to begin.</p>

          <h3 className="mt-8 kicker">Writing / work</h3>
          <ul className="mt-3">
            {SAMPLE_JOBS.map((item) => (
              <Listing key={item.title} {...item} />
            ))}
          </ul>

          <h3 className="mt-8 kicker">Contests & opportunities</h3>
          <ul className="mt-3">
            {SAMPLE_OPPS.map((item) => (
              <Listing key={item.title} {...item} />
            ))}
          </ul>

          <div className="mt-8 border-t border-rule pt-6">
            <h3 className="kicker">Later that afternoon</h3>
            <ul className="mt-3">
              {SAMPLE_DISCOVERIES.map((item) => (
                <Listing key={item.title} {...item} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
