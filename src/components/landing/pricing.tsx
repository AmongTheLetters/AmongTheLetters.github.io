import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLANS, SUBSTACK_URL } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export function Pricing() {
  return (
    <section
      id="pricing"
      className="scroll-mt-28 border-t border-rule py-20 md:py-28"
    >
      <div className="section-shell">
        <div className="mx-auto max-w-2xl text-center">
          <p className="kicker">Pricing</p>

          <h2 className="mt-3 font-display text-masthead font-medium text-ink">
            Read for free, or wander farther for five dollars a month.
          </h2>

          <p className="mt-4 text-lead text-muted">
            Everything happens on Substack. The free edition stands on its
            own. The paid edition is simply for readers who would like more
            opportunities, more discoveries, and a little more room to wander.
          </p>
        </div>

        <div className="mx-auto mt-12 grid min-w-0 grid-cols-[minmax(0,1fr)] max-w-4xl gap-6 md:grid-cols-2">
          {PLANS.map((plan) => (
            <article
              key={plan.id}
              className={cn(
                "min-w-0 w-full max-w-full flex flex-col rounded-xl p-6 md:p-8",
                plan.featured
                  ? "bg-ink text-parchment shadow-[var(--shadow-border)]"
                  : "bg-cream text-ink shadow-[var(--shadow-border)]",
              )}
            >
              <p
                className={cn(
                  "kicker",
                  plan.featured ? "kicker-inverse" : undefined,
                )}
              >
                {plan.featured ? "Full edition" : "Start here"}
              </p>

              <h3 className="mt-3 font-display text-3xl font-medium tracking-tight">
                {plan.name}
              </h3>

              <p className="mt-1 text-sm opacity-75">{plan.blurb}</p>

              <p className="mt-6 font-display text-5xl tracking-tight">
                {plan.price}
                <span className="ml-2 font-sans text-base font-normal opacity-70">
                  {plan.cadence}
                </span>
              </p>

              <ul className="mt-8 flex flex-1 flex-col gap-3">
                {plan.perks.map((perk) => (
                  <li
                    key={perk}
                    className="flex min-w-0 gap-3 text-sm leading-snug"
                  >
                    <Check
                      className={cn(
                        "mt-0.5 size-4 shrink-0",
                        plan.featured ? "text-parchment" : "text-oxblood",
                      )}
                      strokeWidth={2.25}
                    />
                    <span className="min-w-0">{perk}</span>
                  </li>
                ))}
              </ul>

              <Button
                asChild
                variant={plan.featured ? "default" : "outline"}
                size="lg"
                className="mt-8 w-full min-w-0 whitespace-normal text-center"
              >
                <a href={SUBSTACK_URL} target="_blank" rel="noreferrer">
                  {plan.cta}
                </a>
              </Button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
