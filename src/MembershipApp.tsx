import { ArrowRight, BellRing, Check, FileText, Library, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreviewBar } from "@/components/landing/preview-bar";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { CONTACT_EMAIL, LIFETIME_FINAL, RefundNote } from "@/components/refund-note";
import { ACCOUNTS_ON, MODE, PRICES, type Plan } from "@/lib/config";
import { startJoin } from "@/lib/join";
import { useAccount } from "@/lib/use-account";
import { cn } from "@/lib/utils";

const SHARED = [
  "Every listing in the opportunities database",
  "Alerts for saved searches and closing deadlines",
  "A calendar feed for the listings you follow",
  "The paid Among The Letters newsletter on Substack, added for you",
];

const PLANS: { id: Plan; name: string; blurb: string; perks: string[]; tag?: string; dark?: boolean }[] = [
  { id: "monthly", name: "Monthly", blurb: "Try it a month at a time.", perks: [...SHARED, "Cancel anytime"] },
  { id: "annual", name: "Yearly", blurb: "Two months free, billed once a year.", tag: "Two months free", perks: [...SHARED, "Cancel anytime"] },
  {
    id: "lifetime", name: "Founding member", blurb: "Pay once and keep every paid feature for life.", tag: "Founding offer", dark: true,
    perks: ["Everything in monthly and yearly, for life", "Every guide PDF we sell, free to download", "Future products as they are added", "One payment that never renews"],
  },
];

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28 border-t border-rule py-16 md:py-20">
      <div className="section-shell grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div><p className="kicker">{kicker}</p><h2 id={`${id}-h`} className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">{title}</h2></div>
        <div className="max-w-3xl space-y-4 text-muted">{children}</div>
      </div>
    </section>
  );
}

export function MembershipApp() {
  const { ready, session, membership, member } = useAccount();
  const plan = member && membership?.source === "stripe" ? membership.plan : null;
  const cta = (p: Plan): { label: string; onClick?: () => void; href?: string; disabled?: boolean } => {
    if (!ACCOUNTS_ON) return { label: "Memberships open soon", disabled: true };
    if (!ready) return { label: "One moment…", disabled: true };
    if (plan === "lifetime") return { label: "You are a founding member", href: "/account/" };
    if (member && p === "lifetime" && plan) return { label: "Upgrade to founding member", onClick: () => startJoin("lifetime", session) };
    if (member) return { label: plan === p ? "Your current plan" : "Manage on your account page", href: "/account/" };
    return { label: session ? `Continue with ${p === "lifetime" ? "founding" : p === "annual" ? "yearly" : "monthly"}` : "Create an account to join", onClick: () => startJoin(p, session) };
  };

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      {MODE === "preview" ? <PreviewBar states={["visitor", "free", "member", "founding"]} /> : null}
      <SiteHeader />
      <main>
        <section className="pb-14 pt-12 md:pb-20 md:pt-20">
          <div className="section-shell">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-oxblood"><Sparkles className="size-5" strokeWidth={1.75} aria-hidden="true" /><p className="kicker">Membership</p></div>
              <h1 className="text-on-open mt-4 font-display text-masthead font-medium text-ink">Every listing open, and every paid issue in your inbox.</h1>
              <p className="text-on-open mt-5 max-w-2xl text-lead text-muted">
                A membership opens the full opportunities database with alerts, and adds you as a paid subscriber to the <em>Among The Letters</em> newsletter. Founding members also get every guide we sell. Prices are in Canadian dollars.
              </p>
            </div>

            <div className="mt-12 grid gap-5 lg:grid-cols-3">
              {PLANS.map((p) => {
                const c = cta(p.id);
                return (
                  <article key={p.id} id={p.id === "lifetime" ? "founding" : p.id} className={cn("relative flex min-w-0 scroll-mt-28 flex-col rounded-xl p-6 shadow-[var(--shadow-border)] md:p-7", p.dark ? "bg-ink text-parchment" : "bg-cream text-ink")}>
                    {p.tag ? <span className={cn("absolute right-5 top-5 rounded-full px-2.5 py-0.5 text-xs font-semibold", p.dark ? "bg-gold text-ink" : "bg-gold/20 text-[#6b5326]")}>{p.tag}</span> : null}
                    <p className={cn("kicker", p.dark && "kicker-inverse")}>{p.id === "lifetime" ? "Founding" : "Member"}</p>
                    <h2 className="mt-3 font-display text-3xl font-medium tracking-tight">{p.name}</h2>
                    <p className="mt-1 text-sm opacity-75">{p.blurb}</p>
                    <p className="mt-6 font-display text-5xl tracking-tight">CA{PRICES[p.id].label}<span className="ml-2 font-sans text-base font-normal opacity-70">{PRICES[p.id].per}</span></p>
                    <ul className="mt-7 flex flex-1 flex-col gap-3">
                      {p.perks.map((x) => (
                        <li key={x} className="flex min-w-0 gap-3 text-sm leading-snug"><Check className={cn("mt-0.5 size-4 shrink-0", p.dark ? "text-gold-soft" : "text-sage")} strokeWidth={2.25} /><span>{x}</span></li>
                      ))}
                    </ul>
                    {p.id === "lifetime" ? <p className="mt-6 text-xs text-parchment/70">{LIFETIME_FINAL}</p> : null}
                    <div className="mt-6">
                      {c.href ? (
                        <Button asChild size="lg" variant={p.dark ? "default" : "outline"} className={cn("w-full", p.dark && "bg-gold text-ink hover:bg-gold-soft")}><a href={c.href}>{c.label}</a></Button>
                      ) : (
                        <Button size="lg" disabled={c.disabled} onClick={c.onClick} variant={p.dark ? "default" : p.id === "annual" ? "default" : "outline"} className={cn("w-full", p.dark && "bg-gold text-ink hover:bg-gold-soft")}>{c.label}{c.disabled ? null : <ArrowRight className="size-4" />}</Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-dashed border-rule p-5 md:flex-row md:items-start md:justify-between md:gap-10">
              <RefundNote className="text-sm" />
              <p className="flex shrink-0 items-center gap-1.5 text-xs text-faint"><ShieldCheck className="size-3.5" /> Payments are handled by Stripe. We never see your card.</p>
            </div>

            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {([
                [BellRing, "Alerts that find you", "Save a search and hear about new matches. Follow a listing and get a reminder before it closes."],
                [Mail, "The paid newsletter, included", "We add your email as a paid subscriber on Substack, usually within one business day."],
                [Library, "A library for founding members", "Every guide PDF and its tracker files, free on your account page, with new products added as they are released."],
              ] as const).map(([Icon, t, b]) => (
                <div key={t} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-oxblood/10 text-oxblood"><Icon className="size-5" strokeWidth={1.75} /></span>
                  <div><p className="font-display text-lg tracking-tight text-ink">{t}</p><p className="mt-1 text-sm text-muted">{b}</p></div>
                </div>
              ))}
            </div>

            <p className="mt-10 rounded-xl bg-cream p-5 text-sm text-muted shadow-[var(--shadow-border)]">
              Already a paid subscriber on Substack? Make a free account with the same email and the database opens at no extra cost. Using a different email? Write to <a className="text-oxblood hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we will link it.
            </p>
          </div>
        </section>

        <Section id="terms" kicker="The fine print, kept short" title="Membership terms">
          <p>Payments are handled by Stripe. Your receipt and card statement show the business name on our Stripe account, which may not read <em>Among The Letters</em>.</p>
          <p>Monthly and yearly memberships renew automatically until you cancel. You can cancel anytime from your account page, and your plan runs to the end of the period you paid for.</p>
          <p>Memberships aren't refunded automatically. If you cancel early in a billing period, write to us and we'll take a look. The founding membership is a one-time payment of CA$299, never renews and isn't refundable.</p>
          <p>Your paid Substack subscription is added by hand, usually within one business day, and it ends when a monthly or yearly membership ends. Founding members keep it for life.</p>
          <p>Each membership is for one person. Please keep your sign-in and the guide files to yourself.</p>
          <p>Listings are checked against official pages, though details can change. Confirm deadlines, eligibility and fees on each official page before you apply.</p>
        </Section>

        <Section id="privacy" kicker="Your data" title="Privacy">
          <p>An account stores your email address, your membership status and plan, your saved searches, the listings you follow, your alert settings and the alerts we send you. If you turn on browser notifications, we also store the address your browser gives us for them.</p>
          <p>Account data is kept with Supabase. Sign-in emails and alerts are sent through Brevo. Payments go through Stripe, and we never see or store your card number. To add your paid newsletter subscription, your email is entered on Substack.</p>
          <p>We use your email for your account, and for alerts only if you turn them on. We don't sell your data or use it for advertising.</p>
          <p>To delete your account and its data, or with any question, write to <a className="text-oxblood hover:underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          <p className="flex items-center gap-2 text-xs text-faint"><FileText className="size-3.5" /> Last updated October 27, 2026.</p>
        </Section>
      </main>
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
