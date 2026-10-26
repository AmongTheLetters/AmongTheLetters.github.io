import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Bell, CalendarPlus, Check, CircleCheck, Clock, CreditCard, LogOut, Mail, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import {
  PRICES, getAlertPrefs, getMembership, getSession, isMember, mockCancel, mockCompleteCheckout, mockResume, mockSetState, setAlertPrefs, signIn, signOut, signUp,
  type AlertPrefs, type Membership, type Plan,
} from "@/lib/auth";
import { cn } from "@/lib/utils";

const PREVIEW = true;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const nice = (s?: string) => { if (!s) return ""; const [y, m, d] = s.split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };
const inputCls = "mt-1 h-11 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";

function savedChips(f: Record<string, unknown>) {
  const out: string[] = [];
  if (f.type && f.type !== "All") out.push(String(f.type));
  if (f.region && f.region !== "All regions") out.push(String(f.region));
  if (f.genre && f.genre !== "All genres") out.push(String(f.genre));
  if (f.win && f.win !== "any") out.push(f.win === "rolling" ? "Rolling or open now" : `Closes within ${f.win} days`);
  if (f.freeOnly) out.push("Free to enter");
  return out.length ? out : ["Everything"];
}

function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("scroll-mt-24 rounded-xl bg-cream p-6 shadow-[var(--shadow-border)]", className)}>{children}</section>;
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span><span className="block text-sm font-medium text-ink">{label}</span><span className="mt-0.5 block text-sm text-muted">{hint}</span></span>
      <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)}
        className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors", on ? "bg-oxblood" : "bg-ink/20")}>
        <span className={cn("absolute left-0 top-0.5 size-5 rounded-full bg-cream shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
      </button>
    </label>
  );
}

/* ---------- signed out ---------- */
function AuthPanel() {
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    await (mode === "signup" ? signUp : signIn)(email, pw);
    window.location.href = params.get("next") === "join" ? "/account/#join" : "/account/";
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <Card>
        <div role="tablist" className="grid grid-cols-2 rounded-lg bg-paper p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => { setMode(m); setLinkSent(false); }}
              className={cn("rounded-md py-2 text-sm font-medium transition-colors", mode === m ? "bg-cream text-ink shadow-[var(--shadow-border)]" : "text-muted hover:text-ink")}>
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>
        <h2 className="mt-6 font-display text-2xl tracking-tight text-ink">{mode === "signin" ? "Welcome back." : "Make a free account."}</h2>
        <p className="mt-1 text-sm text-muted">{mode === "signin" ? "Sign in to open your listings, alerts and membership." : "Save listings and searches now, and become a member whenever you like."}</p>
        <form onSubmit={submit} className="mt-5">
          <label className="block text-xs font-medium text-muted">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" /></label>
          <label className="mt-3 block text-xs font-medium text-muted">Password<input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder={mode === "signup" ? "At least 8 characters" : ""} /></label>
          {mode === "signin" ? <a href="#" className="mt-2 inline-block text-xs text-oxblood hover:underline">Forgot your password?</a> : null}
          <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : "Create my account"}</Button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-rule" />or<span className="h-px flex-1 bg-rule" /></div>
        <Button variant="outline" className="w-full" disabled={!email || linkSent} onClick={() => setLinkSent(true)}><Mail className="size-4" /> {linkSent ? "Check your inbox for the link" : "Email me a sign-in link"}</Button>
        {mode === "signup" ? <p className="mt-4 text-xs leading-relaxed text-faint">We use your email for your account and the newsletter you choose. You can delete your account at any time.</p> : null}
      </Card>
      <div className="rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)] md:p-8">
        <p className="kicker kicker-inverse">Membership</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">Every opportunity, and every issue.</h2>
        <ul className="mt-6 space-y-4">
          {([
            [ShieldCheck, "The full opportunities database", "Contests, calls, grants, residencies, fellowships and paid markets, all checked against official pages."],
            [Bell, "Alerts that find you", "Saved search emails and a private deadline calendar with reminders."],
            [Mail, "The paid newsletter, included", "We add you as a paid subscriber on Substack, so every paid issue arrives in your inbox."],
          ] as const).map(([Icon, t, b]) => (
            <li key={t} className="flex gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-parchment/10 text-gold-soft"><Icon className="size-5" strokeWidth={1.75} /></span>
              <span><span className="block font-medium">{t}</span><span className="mt-0.5 block text-sm text-parchment/70">{b}</span></span></li>
          ))}
        </ul>
        <p className="mt-8 font-display text-2xl">{PRICES.monthly.label} <span className="text-base text-parchment/70">{PRICES.monthly.per}</span> <span className="mx-2 text-parchment/40">·</span> {PRICES.annual.label} <span className="text-base text-parchment/70">{PRICES.annual.per}</span></p>
        <p className="mt-1 text-sm text-parchment/60">Canadian dollars. Cancel any time.</p>
      </div>
    </div>
  );
}

/* ---------- mock Stripe checkout ---------- */
function CheckoutSheet({ plan, email, onClose }: { plan: Plan; email: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="co-title">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white font-sans shadow-2xl">
        <div className="bg-[#f6f9fc] px-6 py-4 text-xs text-[#697386]">Preview of the secure Stripe checkout page. No card is charged here.</div>
        <div className="p-6">
          <p className="text-sm text-[#697386]">Among The Letters</p>
          <h2 id="co-title" className="mt-1 font-sans text-2xl font-semibold text-[#1a1f36]">Membership, {plan === "annual" ? "yearly" : "monthly"}</h2>
          <p className="mt-1 text-3xl font-semibold text-[#1a1f36]">CA{PRICES[plan].label}<span className="text-base font-normal text-[#697386]"> {PRICES[plan].per === "a month" ? "per month" : "per year"}</span></p>
          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-md border border-[#e3e8ee] px-3 py-2.5 text-[#1a1f36]">{email}</div>
            <div className="rounded-md border border-[#e3e8ee] px-3 py-2.5 text-[#a3acb9]">Card number</div>
          </div>
          <button type="button" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { mockCompleteCheckout(plan); window.location.href = "/account/?welcome=1"; }, 700); }}
            className="mt-5 h-11 w-full rounded-md bg-[#635bff] text-sm font-semibold text-white hover:bg-[#5146e0] disabled:opacity-60">{busy ? "Processing…" : "Subscribe"}</button>
          <button type="button" onClick={onClose} className="mt-3 w-full text-sm text-[#697386] hover:underline">Back to Among The Letters</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- signed in ---------- */
function Dashboard() {
  const session = getSession()!;
  const [m, setM] = useState<Membership>(() => getMembership());
  const [plan, setPlan] = useState<Plan>("annual");
  const [checkout, setCheckout] = useState(false);
  const [prefs, setPrefs] = useState<AlertPrefs>(() => getAlertPrefs());
  const welcome = new URLSearchParams(window.location.search).get("welcome");
  const member = isMember(m);
  const saved: Record<string, unknown> | null = (() => { try { return JSON.parse(localStorage.getItem("atl-opp-search") || "null"); } catch { return null; } })();
  const upd = (k: keyof AlertPrefs) => (v: boolean) => { const n = { ...prefs, [k]: v }; setPrefs(n); setAlertPrefs(n); };
  useEffect(() => { if (window.location.hash === "#join") document.getElementById("join")?.scrollIntoView(); }, []);

  const steps = [
    { label: "Payment received", done: member, date: m.startedAt },
    { label: "Added as a paid subscriber on Substack", done: m.substack === "added", date: m.substackDate },
    { label: "Paid issues arrive in your inbox", done: m.substack === "added" },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        {welcome && member ? (
          <div className="flex items-start gap-3 rounded-xl bg-sage/12 p-5 ring-1 ring-sage/25">
            <CircleCheck className="mt-0.5 size-5 shrink-0 text-moss" />
            <div><p className="font-display text-xl tracking-tight text-ink">Welcome in. Every listing is now open.</p>
              <p className="mt-1 text-sm text-muted">Your paid Substack subscription is being added to {session.email}. It usually takes less than a day.</p></div>
          </div>
        ) : null}
        {m.status === "canceling" ? (
          <div className="flex flex-col gap-3 rounded-xl bg-gold/12 p-5 ring-1 ring-gold/30 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink">Your membership ends on <strong>{nice(m.periodEnd)}</strong>. Listings, alerts and the paid newsletter stay on until then.</p>
            <Button size="sm" onClick={() => { mockResume(); setM(getMembership()); }}>Keep my membership</Button>
          </div>
        ) : null}

        <Card id="join">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="kicker">Membership</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-ink">{member ? (m.status === "canceling" ? "Member until " + nice(m.periodEnd) : "Member") : "Free account"}</h2></div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", member ? (m.status === "canceling" ? "bg-gold/20 text-[#6b5326]" : "bg-sage/15 text-moss") : "bg-paper text-muted ring-1 ring-rule")}>
              {m.status === "active" ? "Active" : m.status === "canceling" ? "Ends soon" : m.status === "past_due" ? "Payment due" : "Free"}</span>
          </div>
          {member ? (
            <>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div><dt className="text-xs text-faint">Plan</dt><dd className="mt-1 text-sm font-medium text-ink">{m.plan === "annual" ? "Yearly" : "Monthly"}, CA{PRICES[m.plan ?? "monthly"].label}</dd></div>
                <div><dt className="text-xs text-faint">{m.status === "canceling" ? "Access ends" : "Renews"}</dt><dd className="mt-1 text-sm font-medium text-ink">{nice(m.periodEnd)}</dd></div>
                <div><dt className="text-xs text-faint">Member since</dt><dd className="mt-1 text-sm font-medium text-ink">{nice(m.startedAt)}</dd></div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-rule pt-5">
                <Button asChild size="sm"><a href="/opportunities/">Open the database <ArrowRight className="size-4" /></a></Button>
                <Button size="sm" variant="outline" onClick={() => alert("At launch this opens the secure Stripe billing page to change card, switch plan, download receipts or cancel.")}><CreditCard className="size-4" /> Billing and receipts</Button>
                {m.status === "active" ? <button type="button" onClick={() => { mockCancel(); setM(getMembership()); }} className="ml-auto text-sm text-faint underline hover:text-oxblood">Cancel membership</button> : null}
              </div>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">Open every listing, turn on alerts and get the paid newsletter on Substack.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Choose a plan">
                {(["monthly", "annual"] as const).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)}
                    className={cn("relative rounded-lg p-4 text-left transition-shadow", plan === p ? "bg-paper ring-2 ring-oxblood" : "bg-paper ring-1 ring-rule hover:ring-rule-strong")}>
                    {p === "annual" ? <span className="absolute right-3 top-3 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-[#6b5326]">Two months free</span> : null}
                    <span className="block text-sm font-medium text-muted">{p === "monthly" ? "Monthly" : "Yearly"}</span>
                    <span className="mt-1 block font-display text-3xl tracking-tight text-ink">{PRICES[p].label}<span className="text-base text-muted"> {PRICES[p].per}</span></span>
                    <span className="mt-1 block text-xs text-faint">{PRICES[p].note}</span>
                  </button>
                ))}
              </div>
              <Button className="mt-5 w-full sm:w-auto" onClick={() => setCheckout(true)}>Continue to secure checkout <ArrowRight className="size-4" /></Button>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><ShieldCheck className="size-3.5" /> Payments are handled by Stripe. We never see your card.</p>
            </>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-oxblood/10 text-oxblood"><Mail className="size-5" strokeWidth={1.75} /></span>
            <div><p className="kicker">Paid newsletter</p><h2 className="mt-1 font-display text-2xl tracking-tight text-ink">Your Substack subscription</h2></div></div>
          {member ? (
            <ol className="mt-5 space-y-3">
              {steps.map((st, i) => (
                <li key={st.label} className="flex items-center gap-3">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", st.done ? "bg-sage text-parchment" : "bg-paper text-faint ring-1 ring-rule")}>{st.done ? <Check className="size-4" /> : i + 1}</span>
                  <span className={cn("text-sm", st.done ? "text-ink" : "text-muted")}>{st.label}{st.date ? <span className="text-faint">, {nice(st.date)}</span> : null}</span>
                  {!st.done && i === 1 ? <span className="ml-auto inline-flex items-center gap-1 text-xs text-[#6b5326]"><Clock className="size-3.5" /> Within one business day</span> : null}
                </li>
              ))}
            </ol>
          ) : <p className="mt-4 text-sm text-muted">Members are added as paid subscribers on Substack using the email on this account, at no extra cost.</p>}
          <p className="mt-5 text-xs text-faint">Uses {session.email}. {m.status === "canceling" ? "The paid subscription ends with your membership." : "If you already pay on Substack, tell us and we will credit you instead of doubling up."}</p>
        </Card>

        <Card id="alerts">
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-oxblood/10 text-oxblood"><Bell className="size-5" strokeWidth={1.75} /></span>
            <div><p className="kicker">Alerts</p><h2 className="mt-1 font-display text-2xl tracking-tight text-ink">What we send you</h2></div></div>
          <div className={cn("mt-3 divide-y divide-rule", !member && "pointer-events-none opacity-50")} aria-disabled={!member}>
            <Toggle on={prefs.weekly} onChange={upd("weekly")} label="Monday Morning Opportunities" hint="The full paid edition through Substack, every Monday." />
            <Toggle on={prefs.closingSoon} onChange={upd("closingSoon")} label="Closing soon" hint="A short Thursday note with saved listings that close within ten days." />
            <Toggle on={prefs.savedSearches} onChange={upd("savedSearches")} label="Saved search matches" hint={saved ? "We email you when a new listing matches your saved search." : "Save a search on the database page to turn this on."} />
            <Toggle on={prefs.calendarFeed} onChange={upd("calendarFeed")} label="Private deadline calendar" hint="A subscribe link for Google, Apple or Outlook calendars that updates by itself." />
          </div>
          {member && prefs.calendarFeed ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-paper p-3 text-xs text-muted">
              <CalendarPlus className="size-4 text-oxblood" /><code className="min-w-0 flex-1 truncate">webcal://amongtheletters.com/cal/••••••••••••.ics</code>
              <button type="button" className="font-medium text-oxblood hover:underline">Copy link</button>
            </div>
          ) : null}
          {!member ? <p className="mt-3 text-sm text-muted">Alerts are part of membership.</p> : null}
        </Card>
      </div>

      <aside className="flex min-w-0 flex-col gap-6">
        <Card>
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-ink text-parchment"><UserRound className="size-5" strokeWidth={1.75} /></span>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{session.email}</p><p className="text-xs text-faint">Account since {nice(session.createdAt)}</p></div></div>
          <div className="mt-5 flex flex-col gap-2 border-t border-rule pt-5 text-sm">
            <a href="/opportunities/" className="flex items-center justify-between text-ink hover:text-oxblood">Opportunities database <ArrowUpRight className="size-4" /></a>
            <a href="#" className="flex items-center justify-between text-ink hover:text-oxblood">Change email or password <ArrowUpRight className="size-4" /></a>
            <a href="#" className="flex items-center justify-between text-ink hover:text-oxblood">Download or delete my data <ArrowUpRight className="size-4" /></a>
          </div>
          <Button variant="outline" size="sm" className="mt-5 w-full" onClick={() => { signOut(); window.location.href = "/account/"; }}><LogOut className="size-4" /> Sign out</Button>
        </Card>
        {saved ? (
          <Card>
            <p className="kicker">Saved search</p>
            <div className="mt-3 flex flex-wrap gap-1.5">{savedChips(saved).map((c) => <span key={c} className="rounded-full bg-sage/12 px-2.5 py-0.5 text-xs font-medium text-moss">{c}</span>)}</div>
            <a href="/opportunities/" className="mt-4 inline-block text-sm font-medium text-oxblood hover:underline">Open it <ArrowUpRight className="inline size-3.5" /></a>
          </Card>
        ) : null}
        <div className="rounded-xl border border-dashed border-rule p-5 text-sm text-muted">
          <Sparkles className="size-4 text-gold" />
          <p className="mt-2">Questions about your membership? Write to <a href="mailto:amongtheletters@gmail.com" className="text-oxblood hover:underline">amongtheletters@gmail.com</a>.</p>
        </div>
      </aside>
      {checkout ? <CheckoutSheet plan={plan} email={session.email} onClose={() => setCheckout(false)} /> : null}
    </div>
  );
}

export function AccountApp() {
  const session = getSession();
  const st = !session ? "visitor" : isMember() ? (getMembership().status === "canceling" ? "canceling" : "member") : "free";
  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      {PREVIEW ? (
        <div className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-1.5 text-xs font-medium tracking-wide text-parchment">
          <span>Preview with pretend accounts. View as</span>
          {(["visitor", "free", "member", "canceling"] as const).map((s) => (
            <button key={s} type="button" onClick={() => { mockSetState(s); window.location.href = "/account/"; }} className={cn("rounded px-2 py-0.5", st === s ? "bg-gold text-ink" : "bg-parchment/10 hover:bg-parchment/20")}>
              {s === "visitor" ? "Signed out" : s === "free" ? "Free account" : s === "member" ? "Member" : "Cancelling"}</button>
          ))}
        </div>
      ) : null}
      <SiteHeader account={session ? { label: "My account", href: "/account/" } : undefined} />
      <main className="pb-20 pt-12 md:pb-28 md:pt-16">
        <div className="section-shell">
          <div className="mb-8 max-w-2xl">
            <div className="flex items-center gap-3 text-oxblood"><UserRound className="size-5" strokeWidth={1.75} /><p className="kicker">{session ? "Your account" : "Members"}</p></div>
            <h1 className="text-on-open mt-4 font-display text-5xl font-medium tracking-tight text-ink md:text-6xl">{session ? "Everything in one place." : "Sign in or join."}</h1>
          </div>
          {session ? <Dashboard /> : <AuthPanel />}
        </div>
      </main>
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
