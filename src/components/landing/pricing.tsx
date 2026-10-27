import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCOUNTS_ON, CONFIG } from "@/lib/config";
import { ArrowRight } from "lucide-react";
import { LIFETIME_URL, MEMBERSHIP_URL, PLANS, SUBSTACK_URL } from "@/lib/site-content";
import { RefundNote } from "@/components/refund-note";
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

          <h2 className="text-on-open mt-3 font-display text-masthead font-medium text-ink">
            Read for free, or wander farther for five dollars a month.
          </h2>

          <p className="text-on-open mt-4 text-lead text-muted">
            The free edition stands on its own. The standard paid newsletter is
            $5 a month through Substack, with expanded daily discoveries and the
            complete Sunday evening Weekly Discoveries Roundup.
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
                        plan.featured ? "text-parchment" : "text-sage",
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

        <aside aria-labelledby="site-membership" className="mx-auto mt-8 max-w-4xl rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)] md:p-8">
          <div className="md:flex md:items-end md:justify-between md:gap-10">
            <div className="max-w-2xl">
              <p className="kicker kicker-inverse">Website membership</p>
              <h3 id="site-membership" className="mt-2 font-display text-3xl font-medium tracking-tight">
                The opportunities database, alerts and the paid newsletter.
              </h3>
              <p className="mt-3 text-parchment/75">
                CA$7 a month, CA$70 a year, or CA$299 once as a founding member. Every plan opens every listing, sends alerts for your saved searches and adds you as a paid subscriber on Substack.
              </p>
            </div>
            <Button asChild size="lg" className="mt-6 shrink-0 bg-gold text-ink hover:bg-gold-soft md:mt-0">
              <a href={MEMBERSHIP_URL}>See membership <ArrowRight className="size-4" /></a>
            </Button>
          </div>
          <RefundNote inverse className="mt-5" />
        </aside>

        <aside className="mx-auto mt-6 max-w-4xl rounded-xl border border-bark/30 bg-cream p-6 shadow-[var(--shadow-border)] md:flex md:items-center md:justify-between md:gap-10 md:p-8">
          <div className="max-w-2xl">
            <p className="kicker">Founding offer</p>
            <h3 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">
              A $299 CAD founding lifetime membership.
            </h3>
            <p className="mt-3 text-muted">
              Pay once and become a founding member, with every paid feature for life. That means the paid <em>Among The Letters</em> newsletter, the full opportunities database with its notifications, all current guide PDFs and future products as they are added. It never renews. It's a one-time payment and isn't refundable.
            </p>
          </div>
          <Button asChild variant="outline" size="lg" className="mt-6 shrink-0 md:mt-0">
            {ACCOUNTS_ON && CONFIG.stripeLifetime ? (
              <a href={LIFETIME_URL}>Become a founding member</a>
            ) : (
              <a href="mailto:amongtheletters@gmail.com?subject=Founding%20Lifetime%20Membership%20Inquiry">
                Ask about lifetime membership
              </a>
            )}
          </Button>
        </aside>
      </div>
    </section>
  );
}
