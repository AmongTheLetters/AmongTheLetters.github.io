import { SubstackLink } from "@/components/landing/substack-link";

export function Subscribe() {
  return (
    <section
      id="subscribe"
      className="scroll-mt-28 border-t border-rule bg-ink py-20 text-parchment md:py-28"
    >
      <div className="section-shell grid min-w-0 grid-cols-[minmax(0,1fr)] items-center gap-12 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="kicker kicker-inverse">Come along</p>

          <h2 className="mt-3 font-display text-masthead font-medium">
            Wander among the letters.
          </h2>

          <p className="mt-4 max-w-xl text-lead text-parchment/75">
            The newsletter lives entirely on Substack. Read for free,
            subscribe if you would like it delivered, or choose the full
            edition if you want more of what we find.
          </p>

          <div className="mt-8">
            <SubstackLink
              label="Visit Among The Letters on Substack"
              invert
            />
          </div>
        </div>

        <figure className="min-w-0 w-full max-w-full">
          <img
            src="./images/books.jpg"
            alt="Stacked clothbound books on a walnut table, with a cream envelope tucked between the spines."
            className="img-frame block aspect-video h-auto w-full max-w-full rounded-xl object-cover"
            width={1600}
            height={1200}
          />
        </figure>
      </div>
    </section>
  );
}
