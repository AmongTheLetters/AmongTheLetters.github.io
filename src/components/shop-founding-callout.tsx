/* Founding membership callout on the Shop page. Visitors and free accounts are pointed to the membership page,
   monthly, yearly and Substack members can upgrade, and founding members are sent to their library instead. */
import { ArrowRight, Check, Library } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LIFETIME_FINAL } from "@/components/refund-note";
import { ACCOUNTS_ON, PRICES } from "@/lib/config";
import { startJoin } from "@/lib/join";
import { MEMBERSHIP_URL } from "@/lib/site-content";
import { useAccount } from "@/lib/use-account";

const PERKS: React.ReactNode[] = [
  "Every PDF guide in this shop, free to download, tracker files included",
  <>The paid <em>Among The Letters</em> newsletter on Substack</>,
  "The full opportunities database, with alerts for saved searches and deadlines",
  "Future products as they are added",
];

export function ShopFoundingCallout() {
  const { ready, session, membership, member } = useAccount();
  const founding = member && membership?.source !== "substack" && membership?.plan === "lifetime";
  const canUpgrade = ACCOUNTS_ON && ready && member && !founding;

  return (
    <aside id="founding" aria-labelledby="founding-callout-heading"
      className="relative mt-16 scroll-mt-28 overflow-hidden rounded-xl border border-bark/25 bg-cream shadow-[var(--shadow-border)] md:mt-20">
      <div className="grid gap-8 p-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)] md:items-center md:gap-12 md:p-10">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <p className="kicker">Founding membership</p>
            <span className="rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-[#6b5326]">{founding ? "Founding member" : "Founding offer"}</span>
          </div>
          {founding ? (
            <>
              <h2 id="founding-callout-heading" className="text-on-open mt-3 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
                Every guide here is already yours.
              </h2>
              <p className="mt-4 max-w-xl text-muted">
                As a founding member you can download every guide in this shop free from your account, tracker files included. New products appear in your library as they are released.
              </p>
            </>
          ) : (
            <>
              <h2 id="founding-callout-heading" className="text-on-open mt-3 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
                Every guide, free for founding members.
              </h2>
              <p className="mt-4 max-w-xl text-muted">
                The founding membership is one payment that never renews. It includes every paid feature for as long as the service runs.
              </p>
              <ul className="mt-6 grid gap-3 sm:grid-cols-2">
                {PERKS.map((perk, i) => (
                  <li key={i} className="flex min-w-0 gap-3 text-sm leading-snug text-ink">
                    <Check className="mt-0.5 size-4 shrink-0 text-sage" strokeWidth={2.25} aria-hidden="true" />
                    <span>{perk}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="min-w-0 border-t border-rule pt-6 md:border-l md:border-t-0 md:pl-10 md:pt-0">
          {founding ? (
            <>
              <p className="flex items-center gap-2 font-display text-2xl tracking-tight text-ink"><Library className="size-5 text-oxblood" strokeWidth={1.75} aria-hidden="true" /> Your library</p>
              <p className="mt-2 text-sm text-muted">Guides, trackers and future products, all in one place.</p>
              <Button asChild size="lg" className="mt-6 w-full">
                <a href="/account/#library">Open your founding library <ArrowRight className="size-4" /></a>
              </Button>
            </>
          ) : (
            <>
              <p className="font-display text-5xl tracking-tight text-ink">
                CA{PRICES.lifetime.label}<span className="ml-2 font-sans text-base font-normal text-muted">{PRICES.lifetime.per}</span>
              </p>
              <p className="mt-2 text-sm text-muted">Charged in Canadian dollars.</p>
              {canUpgrade ? (
                <Button size="lg" className="mt-6 w-full" onClick={() => startJoin("lifetime", session)}>
                  Upgrade to founding member <ArrowRight className="size-4" />
                </Button>
              ) : (
                <Button asChild size="lg" className="mt-6 w-full">
                  <a href={`${MEMBERSHIP_URL}#founding`}>See the founding membership <ArrowRight className="size-4" /></a>
                </Button>
              )}
              <p className="mt-3 text-center text-sm">
                <a href={MEMBERSHIP_URL} className="font-medium text-oxblood underline-offset-4 hover:underline">Compare all membership plans</a>
              </p>
              <p className="mt-4 text-xs text-faint">{LIFETIME_FINAL}</p>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
