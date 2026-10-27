import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, Bell, BellRing, CalendarPlus, Check, CircleCheck, ClipboardList, Clock, CreditCard, Download, FileSpreadsheet, Library, LogOut, Mail, MonitorSmartphone, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PreviewBar } from "@/components/landing/preview-bar";
import {
  api, checkoutUrl, disablePush, enablePush, isMember, portalUrl, previewCancel, previewCheckout, pushSupported,
  type Frequency, type Membership, type Prefs, type SavedSearch, type Session, type TodoItem,
} from "@/lib/backend";
import { ACCOUNTS_ON, CONFIG, MODE, PRICES, type Plan } from "@/lib/config";
import { describeFilters, longDate, timeAgo } from "@/lib/opportunities";
import { FOUNDING_LIBRARY, SHOP_IMAGE_BASE } from "@/lib/shop-content";
import { cn } from "@/lib/utils";

const inputCls = "mt-1 h-11 w-full rounded-md border border-rule bg-paper px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";
const PLAN_NAME: Record<Plan, string> = { monthly: "Monthly", annual: "Yearly", lifetime: "Lifetime" };
const errText = (e: unknown) => (e instanceof Error ? e.message : "Something went wrong. Please try again.");

function Card({ children, className, id }: { children: React.ReactNode; className?: string; id?: string }) {
  return <section id={id} className={cn("scroll-mt-24 rounded-xl bg-cream p-6 shadow-[var(--shadow-border)]", className)}>{children}</section>;
}
function CardHead({ icon: Icon, kicker, title }: { icon: typeof Bell; kicker: string; title: string }) {
  return <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-oxblood/10 text-oxblood"><Icon className="size-5" strokeWidth={1.75} /></span>
    <div><p className="kicker">{kicker}</p><h2 className="mt-1 font-display text-2xl tracking-tight text-ink">{title}</h2></div></div>;
}
function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40", on ? "bg-oxblood" : "bg-ink/20")}>
      <span className={cn("absolute left-0 top-0.5 size-5 rounded-full bg-cream shadow transition-transform", on ? "translate-x-5" : "translate-x-0.5")} />
    </button>
  );
}
function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return <div className="flex items-start justify-between gap-4 py-3.5"><span><span className="block text-sm font-medium text-ink">{label}</span><span className="mt-0.5 block text-sm text-muted">{hint}</span></span><span className="mt-0.5 shrink-0">{children}</span></div>;
}

/* ---------------- signed out ---------------- */
function AuthPanel() {
  const params = new URLSearchParams(window.location.search);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">(params.get("mode") === "signup" ? "signup" : "signin");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const wanted = params.get("plan");
  const next = params.get("next") === "join" ? `/account/${wanted && wanted in PRICES ? `?plan=${wanted}` : ""}#join` : "/account/";
  const run = async (fn: () => Promise<void>) => { setBusy(true); setMsg(null); try { await fn(); } catch (e) { setMsg({ ok: false, text: errText(e) }); } finally { setBusy(false); } };

  const submit = (e: FormEvent) => { e.preventDefault(); run(async () => {
    if (mode === "forgot") { await api.resetPassword(email); setMsg({ ok: true, text: "If there is an account for that email, a reset link is on its way." }); return; }
    if (mode === "signup") { const r = await api.signUp(email, pw); if (r.needsConfirm) { setMsg({ ok: true, text: "Check your inbox and click the link to confirm your email. Then you are in." }); return; } }
    else await api.signIn(email, pw);
    window.location.href = next;
  }); };
  const magic = () => run(async () => { await api.magicLink(email); setMsg({ ok: true, text: `A sign-in link is on its way to ${email}.` }); });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr] lg:items-start">
      <Card>
        {mode !== "forgot" ? (
          <div role="tablist" className="grid grid-cols-2 rounded-lg bg-paper p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button key={m} role="tab" type="button" aria-selected={mode === m} onClick={() => { setMode(m); setMsg(null); }}
                className={cn("rounded-md py-2 text-sm font-medium transition-colors", mode === m ? "bg-cream text-ink shadow-[var(--shadow-border)]" : "text-muted hover:text-ink")}>
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>
        ) : null}
        <h2 className="mt-6 font-display text-2xl tracking-tight text-ink">{mode === "signin" ? "Welcome back." : mode === "signup" ? "Make a free account." : "Reset your password."}</h2>
        <p className="mt-1 text-sm text-muted">{mode === "signin" ? "Sign in to open your listings, notifications and membership." : mode === "signup" ? "Follow listings and save searches now, and become a member whenever you like." : "We will email you a link to choose a new password."}</p>
        <form onSubmit={submit} className="mt-5">
          <label className="block text-xs font-medium text-muted">Email<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="you@example.com" /></label>
          {mode !== "forgot" ? <label className="mt-3 block text-xs font-medium text-muted">Password<input type="password" required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder={mode === "signup" ? "At least 8 characters" : ""} /></label> : null}
          {mode === "signin" ? <button type="button" onClick={() => { setMode("forgot"); setMsg(null); }} className="mt-2 text-xs text-oxblood hover:underline">Forgot your password?</button> : null}
          <Button type="submit" className="mt-4 w-full" disabled={busy}>{busy ? "One moment…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create my account" : "Send the reset link"}</Button>
        </form>
        {msg ? <p role="status" className={cn("mt-3 rounded-md px-3 py-2 text-sm", msg.ok ? "bg-sage/12 text-moss" : "bg-oxblood/10 text-oxblood")}>{msg.text}</p> : null}
        {mode === "forgot" ? <button type="button" onClick={() => { setMode("signin"); setMsg(null); }} className="mt-4 text-sm text-muted hover:text-ink">Back to sign in</button> : (
          <>
            <div className="my-5 flex items-center gap-3 text-xs text-faint"><span className="h-px flex-1 bg-rule" />or<span className="h-px flex-1 bg-rule" /></div>
            <Button variant="outline" className="w-full" disabled={!email || busy} onClick={magic}><Mail className="size-4" /> Email me a sign-in link</Button>
            {CONFIG.googleSignIn ? <Button variant="outline" className="mt-2 w-full" onClick={() => run(api.google)}>Continue with Google</Button> : null}
            {mode === "signup" ? <p className="mt-4 text-xs leading-relaxed text-faint">We use your email for your account, and for alerts only if you turn them on. You can delete your account at any time.</p> : null}
          </>
        )}
      </Card>
      <div className="rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)] md:p-8">
        <p className="kicker kicker-inverse">Membership</p>
        <h2 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">Every opportunity, and every issue.</h2>
        <ul className="mt-6 space-y-4">
          {([
            [ShieldCheck, "The full opportunities database", "Contests, calls, grants, residencies, fellowships and paid markets, all checked against official pages."],
            [BellRing, "Notifications that find you", "New matches for your saved searches and reminders before followed listings close, right here on the site."],
            [Mail, "The paid newsletter, included", "We add you as a paid subscriber on Substack, so every paid issue arrives in your inbox."],
          ] as const).map(([Icon, t, b]) => (
            <li key={t} className="flex gap-4"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-parchment/10 text-gold-soft"><Icon className="size-5" strokeWidth={1.75} /></span>
              <span><span className="block font-medium">{t}</span><span className="mt-0.5 block text-sm text-parchment/70">{b}</span></span></li>
          ))}
        </ul>
        <p className="mt-8 font-display text-2xl">{PRICES.monthly.label} <span className="text-base text-parchment/70">{PRICES.monthly.per}</span> <span className="mx-2 text-parchment/40">·</span> {PRICES.annual.label} <span className="text-base text-parchment/70">{PRICES.annual.per}</span> <span className="mx-2 text-parchment/40">·</span> {PRICES.lifetime.label} <span className="text-base text-parchment/70">{PRICES.lifetime.per} for life</span></p>
        <p className="mt-2 text-sm text-parchment/70">Founding members pay once for every paid feature, all current guide PDFs and future products as they are added.</p>
        <p className="mt-1 text-sm text-parchment/60">Canadian dollars. Cancel any time. Paid Substack subscribers get it all at no extra cost.</p>
      </div>
    </div>
  );
}

function NewPassword() {
  const [pw, setPw] = useState(""); const [done, setDone] = useState(false); const [err, setErr] = useState("");
  return (
    <Card className="max-w-md">
      <h2 className="font-display text-2xl tracking-tight text-ink">Choose a new password</h2>
      {done ? <p className="mt-3 text-sm text-moss">Saved. You are signed in.</p> : (
        <form onSubmit={async (e) => { e.preventDefault(); try { await api.updatePassword(pw); setDone(true); history.replaceState(null, "", "/account/"); } catch (x) { setErr(errText(x)); } }}>
          <input type="password" minLength={8} required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} placeholder="At least 8 characters" />
          {err ? <p className="mt-2 text-sm text-oxblood">{err}</p> : null}
          <Button type="submit" className="mt-4">Save password</Button>
        </form>
      )}
    </Card>
  );
}

/* ---------------- review-only checkout stand-in ---------------- */
function PreviewCheckout({ plan, email, onClose }: { plan: Plan; email: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="co-title">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white font-sans shadow-2xl">
        <div className="bg-[#f6f9fc] px-6 py-4 text-xs text-[#697386]">Stand-in for the Stripe checkout page in review builds. No card is charged.</div>
        <div className="p-6">
          <p className="text-sm text-[#697386]">Among The Letters</p>
          <h2 id="co-title" className="mt-1 font-sans text-2xl font-semibold text-[#1a1f36]">Membership, {PLAN_NAME[plan].toLowerCase()}</h2>
          <p className="mt-1 text-3xl font-semibold text-[#1a1f36]">CA{PRICES[plan].label}<span className="text-base font-normal text-[#697386]"> {plan === "lifetime" ? "one time" : plan === "annual" ? "per year" : "per month"}</span></p>
          <div className="mt-5 space-y-3 text-sm"><div className="rounded-md border border-[#e3e8ee] px-3 py-2.5 text-[#1a1f36]">{email}</div><div className="rounded-md border border-[#e3e8ee] px-3 py-2.5 text-[#a3acb9]">Card number</div></div>
          <button type="button" disabled={busy} onClick={() => { setBusy(true); setTimeout(() => { previewCheckout(plan); window.location.href = "/account/?welcome=1"; }, 600); }}
            className="mt-5 h-11 w-full rounded-md bg-[#635bff] text-sm font-semibold text-white hover:bg-[#5146e0] disabled:opacity-60">{busy ? "Processing…" : "Subscribe"}</button>
          <button type="button" onClick={onClose} className="mt-3 w-full text-sm text-[#697386] hover:underline">Back to Among The Letters</button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- alerts ---------------- */
const FREQ: [Frequency, string][] = [["instant", "As it happens"], ["daily", "Daily digest"], ["weekly", "Weekly digest"]];

function AlertSettings({ member }: { member: boolean }) {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [follows, setFollows] = useState(0);
  const [pushBusy, setPushBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!member) return;
    api.getPrefs().then(setPrefs).catch(() => undefined);
    api.listSearches().then(setSearches).catch(() => undefined);
    api.listFollows().then((f) => setFollows(f.length)).catch(() => undefined);
  }, [member]);
  const savePrefs = (p: Prefs) => { setPrefs(p); api.setPrefs(p).catch(() => undefined); };
  const patch = (id: string, p: Partial<SavedSearch>) => { setSearches((l) => l.map((s) => (s.id === id ? { ...s, ...p } : s))); api.updateSearch(id, p).catch(() => undefined); };
  const remove = (id: string) => { setSearches((l) => l.filter((s) => s.id !== id)); api.deleteSearch(id).catch(() => undefined); };
  const togglePush = async () => {
    if (!prefs) return; setPushBusy(true);
    try { if (prefs.pushEnabled) { await disablePush(); savePrefs({ ...prefs, pushEnabled: false }); } else if (await enablePush()) savePrefs({ ...prefs, pushEnabled: true }); }
    finally { setPushBusy(false); }
  };
  const cal = api.calendarUrl(prefs?.calendarToken);
  const canPush = MODE === "preview" || pushSupported();

  return (
    <Card id="alerts">
      <CardHead icon={Bell} kicker="Alerts" title="How we let you know" />
      {!member ? <p className="mt-4 text-sm text-muted">Notifications and alerts are part of membership.</p> : !prefs ? <p className="mt-4 text-sm text-faint">Loading…</p> : (
        <>
          <div className="mt-3 divide-y divide-rule">
            <Row label="Notifications on the site" hint="Always on for members. New matches and reminders appear in the bell at the top of every page."><span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2.5 py-1 text-xs font-semibold text-moss"><Check className="size-3.5" /> On</span></Row>
            <Row label="Email alerts" hint={prefs.emailEnabled ? "On. Choose which saved searches send email below." : "Off. Turn on to get email for the saved searches you pick."}><Switch label="Email alerts" on={prefs.emailEnabled} onChange={(v) => savePrefs({ ...prefs, emailEnabled: v })} /></Row>
            <Row label="Closing reminders for listings you follow" hint={`You follow ${follows} ${follows === 1 ? "listing" : "listings"}. We remind you before each deadline.`}>
              <select aria-label="Reminder timing" value={prefs.closingSoonDays} onChange={(e) => savePrefs({ ...prefs, closingSoonDays: Number(e.target.value) })} className="h-9 rounded-md border border-rule bg-paper px-2 text-sm text-ink">
                {[3, 7, 10, 14].map((d) => <option key={d} value={d}>{d} days before</option>)}
              </select>
            </Row>
            <Row label="Browser notifications" hint={canPush ? "Optional. A pop-up from your browser even when the site is closed, on this device only." : "Not available in this browser."}>
              <Button size="sm" variant={prefs.pushEnabled ? "outline" : "default"} disabled={!canPush || pushBusy} onClick={togglePush}><MonitorSmartphone className="size-4" /> {prefs.pushEnabled ? "Turn off" : "Turn on"}</Button>
            </Row>
          </div>

          <div className="mt-5 border-t border-rule pt-5">
            <p className="text-sm font-medium text-ink">Saved searches</p>
            {searches.length ? (
              <ul className="mt-3 flex flex-col gap-3">
                {searches.map((s) => (
                  <li key={s.id} className="rounded-lg bg-paper p-4 ring-1 ring-rule">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">{describeFilters(s.filters).map((c) => <span key={c} className="rounded-full bg-sage/12 px-2.5 py-0.5 text-xs font-medium text-moss">{c}</span>)}</div>
                      <div className="flex items-center gap-3">
                        <a href={`/opportunities/?s=${s.id}`} className="text-xs font-medium text-oxblood hover:underline">Open</a>
                        <button type="button" onClick={() => remove(s.id)} aria-label={`Delete ${s.name}`} className="text-faint hover:text-oxblood"><Trash2 className="size-4" /></button>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <label className="flex items-center justify-between gap-2 text-sm text-ink">On the site <Switch label="On the site" on={s.onsite} onChange={(v) => patch(s.id, { onsite: v })} /></label>
                      <label className="flex items-center justify-between gap-2 text-sm text-ink">Email <Switch label="Email" on={s.email && prefs.emailEnabled} disabled={!prefs.emailEnabled} onChange={(v) => patch(s.id, { email: v })} /></label>
                      <select aria-label="How often" value={s.frequency} onChange={(e) => patch(s.id, { frequency: e.target.value as Frequency })} className="h-9 rounded-md border border-rule bg-cream px-2 text-sm text-ink">
                        {FREQ.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">No saved searches yet. Set some filters on the <a href="/opportunities/" className="text-oxblood hover:underline">database page</a> and choose Save this search.</p>}
          </div>

          {cal ? (
            <div className="mt-5 border-t border-rule pt-5">
              <p className="flex items-center gap-2 text-sm font-medium text-ink"><CalendarPlus className="size-4 text-oxblood" /> Private deadline calendar</p>
              <p className="mt-1 text-sm text-muted">Subscribe in Google, Apple or Outlook calendars. It shows the listings you follow and updates by itself.</p>
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-paper p-3 text-xs text-muted ring-1 ring-rule">
                <code className="min-w-0 flex-1 truncate">{cal}</code>
                <button type="button" onClick={() => { navigator.clipboard?.writeText(cal); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="shrink-0 font-medium text-oxblood hover:underline">{copied ? "Copied" : "Copy link"}</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

/* ---------------- founding (lifetime) members, free guide downloads ---------------- */
function FoundingLibrary() {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState("");
  // Links are fetched fresh on each click because they expire after ten minutes.
  const download = async (fileId: string) => {
    setBusy(fileId); setErr("");
    try {
      if (MODE === "preview") { alert("Downloads the file through a private link that expires after ten minutes."); return; }
      const url = (await api.foundingDownloads())[fileId];
      if (!url) throw new Error("That file is not available right now. Please write to us.");
      window.location.href = url;
    } catch (e) { setErr(errText(e)); } finally { setBusy(null); }
  };
  return (
    <Card id="library">
      <CardHead icon={Library} kicker="Founding member" title="Your founding member library" />
      <p className="mt-3 text-sm text-muted">Every guide we sell is yours to download free, along with its tracker files. New products are added here as they are released.</p>
      <ul className="mt-5 grid gap-4 sm:grid-cols-3">
        {FOUNDING_LIBRARY.map((g) => (
          <li key={g.id} className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-paper ring-1 ring-rule">
            {g.cover ? (
              <img src={`${SHOP_IMAGE_BASE}/${g.cover}-cover-480.webp`} alt={`Cover of ${g.title}`} loading="lazy" width={480} height={720}
                className="aspect-[2/3] w-full bg-cream object-cover" />
            ) : (
              <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 bg-ink text-parchment">
                <FileSpreadsheet className="size-12 text-gold-soft" strokeWidth={1.25} />
                <span className="font-display text-lg tracking-tight">Submission tracker</span>
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="font-display text-xl tracking-tight text-ink">{g.title}</h3>
              <p className="mt-1 text-sm text-muted">{g.blurb}</p>
              <div className="mt-auto flex flex-col gap-2 pt-4">
                {g.files.map((f) => (
                  <Button key={f.id} size="sm" variant={g.files.length > 1 && f.label === "CSV" ? "outline" : "default"} disabled={busy !== null} onClick={() => download(f.id)} className="w-full justify-between">
                    <span className="inline-flex items-center gap-1.5"><Download className="size-4" /> {busy === f.id ? "Preparing…" : `Download ${f.label}`}</span>
                    <span className="text-xs opacity-70">{f.detail}</span>
                  </Button>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {err ? <p role="alert" className="mt-3 rounded-md bg-oxblood/10 px-3 py-2 text-sm text-oxblood">{err}</p> : null}
      <p className="mt-4 text-xs text-faint">For your own use. Download links are private to your account and expire after ten minutes.</p>
    </Card>
  );
}

/* ---------------- admin, the Substack to-do list ---------------- */
function SubstackTodo() {
  const [items, setItems] = useState<TodoItem[] | null>(null);
  useEffect(() => { api.listTodo().then(setItems).catch(() => setItems([])); }, []);
  const done = (id: number) => { setItems((l) => l?.filter((x) => x.id !== id) ?? null); api.markTodoDone(id).catch(() => undefined); };
  return (
    <Card>
      <CardHead icon={ClipboardList} kicker="Admin" title="Substack to-do" />
      <p className="mt-3 text-sm text-muted">Substack dashboard, Subscribers, select the email, three-dot menu, then Comp or Remove. Cancel items are done in the Stripe dashboard.</p>
      {items === null ? <p className="mt-4 text-sm text-faint">Loading…</p> : items.length ? (
        <ul className="mt-4 divide-y divide-rule">
          {items.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
              <span className={cn("rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide", t.action === "remove" ? "bg-oxblood/10 text-oxblood" : t.action === "cancel_subscription" ? "bg-gold/20 text-[#6b5326]" : "bg-sage/15 text-moss")}>{t.action === "comp" ? "Comp" : t.action === "extend" ? "Extend" : t.action === "cancel_subscription" ? "Cancel old plan" : "Remove"}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{t.email}</span>
              {t.note ? <span className="basis-full text-xs text-muted">{t.note}</span> : null}
              <span className="text-xs text-faint">{t.action === "remove" || t.action === "cancel_subscription" ? "" : t.compUntil ? `1 year, to ${longDate(t.compUntil)}` : "Forever"} · {timeAgo(t.createdAt)}</span>
              <Button size="sm" variant="outline" onClick={() => done(t.id)}><Check className="size-4" /> Done</Button>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 text-sm text-moss">All caught up.</p>}
    </Card>
  );
}

/* ---------------- signed in ---------------- */
function Dashboard({ session }: { session: Session }) {
  const [m, setM] = useState<Membership | null>(null);
  const [plan, setPlan] = useState<Plan>(() => { const p = new URLSearchParams(window.location.search).get("plan"); return p && p in PRICES ? (p as Plan) : "annual"; });
  const [checkout, setCheckout] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const welcome = new URLSearchParams(window.location.search).get("welcome");
  useEffect(() => { api.getMembership().then(setM).catch(() => setM(null)); }, []);
  useEffect(() => { if (m && window.location.hash) setTimeout(() => document.querySelector(window.location.hash)?.scrollIntoView(), 50); }, [m]);
  if (!m) return <p className="text-sm text-faint">Loading your account…</p>;
  const member = isMember(m);
  const viaSubstack = m.source === "substack";
  const lifetime = member && !viaSubstack && m.plan === "lifetime";
  const goCheckout = () => { if (MODE === "preview") { setCheckout(true); return; } const u = checkoutUrl(plan, session); if (u) window.location.href = u; };
  const upgrade = () => { if (MODE === "preview") { setPlan("lifetime"); setCheckout(true); return; } const u = checkoutUrl("lifetime", session); if (u) window.location.href = u; };
  const billing = () => { if (MODE === "preview") { alert("Opens the secure Stripe billing page to change card, switch plan, see receipts or cancel."); return; } const u = portalUrl(session.email); if (u) window.location.href = u; };
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
            <p className="text-sm text-ink">Your membership ends on <strong>{longDate(m.periodEnd)}</strong>. Listings, notifications and the paid newsletter stay on until then.</p>
            <Button size="sm" onClick={() => { if (MODE === "preview") { previewCancel(false); api.getMembership().then(setM); } else billing(); }}>Keep my membership</Button>
          </div>
        ) : null}
        {m.status === "past_due" ? <div className="rounded-xl bg-oxblood/10 p-5 text-sm text-oxblood ring-1 ring-oxblood/20">Your last payment did not go through. Update your card in billing to keep your membership.</div> : null}

        <Card id="join">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="kicker">Membership</p>
              <h2 className="mt-2 font-display text-3xl tracking-tight text-ink">{viaSubstack ? "Member through Substack" : lifetime ? "Founding member" : member ? (m.status === "canceling" ? `Member until ${longDate(m.periodEnd)}` : "Member") : "Free account"}</h2></div>
            <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", member ? (m.status === "canceling" ? "bg-gold/20 text-[#6b5326]" : "bg-sage/15 text-moss") : "bg-paper text-muted ring-1 ring-rule")}>
              {lifetime ? "For life" : m.status === "active" ? "Active" : m.status === "canceling" ? "Ends soon" : m.status === "past_due" ? "Payment due" : "Free"}</span>
          </div>
          {viaSubstack ? (
            <>
              <p className="mt-3 text-sm text-muted">Your paid Substack subscription for {session.email} opens everything here at no extra cost. It stays on while your Substack subscription is active.</p>
              <div className="mt-5 border-t border-rule pt-5"><Button asChild size="sm"><a href="/opportunities/">Open the database <ArrowRight className="size-4" /></a></Button></div>
            </>
          ) : member ? (
            <>
              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div><dt className="text-xs text-faint">Plan</dt><dd className="mt-1 text-sm font-medium text-ink">{lifetime && m.comped ? "Founding, complimentary" : <>{PLAN_NAME[m.plan ?? "monthly"]}, CA{PRICES[m.plan ?? "monthly"].label}{lifetime ? " once" : ""}</>}</dd></div>
                {lifetime
                  ? <div><dt className="text-xs text-faint">Renews</dt><dd className="mt-1 text-sm font-medium text-ink">Never, paid once</dd></div>
                  : <div><dt className="text-xs text-faint">{m.status === "canceling" ? "Access ends" : "Renews"}</dt><dd className="mt-1 text-sm font-medium text-ink">{longDate(m.periodEnd)}</dd></div>}
                <div><dt className="text-xs text-faint">Member since</dt><dd className="mt-1 text-sm font-medium text-ink">{longDate(m.startedAt)}</dd></div>
              </dl>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-rule pt-5">
                <Button asChild size="sm"><a href="/opportunities/">Open the database <ArrowRight className="size-4" /></a></Button>
                {lifetime && m.comped ? null : <Button size="sm" variant="outline" onClick={billing}><CreditCard className="size-4" /> Billing and receipts</Button>}
                {m.status === "active" && !lifetime ? <button type="button" onClick={() => { if (MODE === "preview") { previewCancel(true); api.getMembership().then(setM); } else billing(); }} className="ml-auto text-sm text-faint underline hover:text-oxblood">Cancel membership</button> : null}
              </div>
              {!lifetime && (CONFIG.stripeLifetime || MODE === "preview") ? (
                <div className="mt-5 flex flex-col gap-4 rounded-lg bg-paper p-4 ring-1 ring-rule sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-display text-xl tracking-tight text-ink">Become a founding member <span className="rounded-full bg-oxblood/10 px-2 py-0.5 font-sans text-[11px] font-semibold text-oxblood">Founding offer</span></p>
                    <p className="mt-1 text-sm text-muted">One payment of CA{PRICES.lifetime.label} covers every paid feature for life, including every guide PDF and future products as they are added. Your current plan stops automatically, so you are never charged twice.</p>
                  </div>
                  <Button size="sm" className="shrink-0" onClick={upgrade}>Upgrade to founding member <ArrowRight className="size-4" /></Button>
                </div>
              ) : null}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted">Open every listing, get notifications for your searches and the paid newsletter on Substack.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Choose a plan">
                {(["monthly", "annual", "lifetime"] as const).map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={plan === p} onClick={() => setPlan(p)}
                    className={cn("relative rounded-lg p-4 text-left transition-shadow", plan === p ? "bg-paper ring-2 ring-oxblood" : "bg-paper ring-1 ring-rule hover:ring-rule-strong")}>
                    {p === "annual" ? <span className="absolute right-3 top-3 rounded-full bg-gold/20 px-2 py-0.5 text-[11px] font-semibold text-[#6b5326]">Two months free</span> : null}
                    {p === "lifetime" ? <span className="absolute right-3 top-3 rounded-full bg-oxblood/10 px-2 py-0.5 text-[11px] font-semibold text-oxblood">Founding offer</span> : null}
                    <span className="block text-sm font-medium text-muted">{PLAN_NAME[p]}</span>
                    <span className="mt-1 block font-display text-3xl tracking-tight text-ink">{PRICES[p].label}<span className="text-base text-muted"> {PRICES[p].per}</span></span>
                    <span className="mt-1 block text-xs text-faint">{PRICES[p].note}</span>
                  </button>
                ))}
              </div>
              <Button className="mt-5 w-full sm:w-auto" onClick={goCheckout}>Continue to secure checkout <ArrowRight className="size-4" /></Button>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-faint"><ShieldCheck className="size-3.5" /> Payments are handled by Stripe. We never see your card.</p>
              <p className="mt-2 text-xs text-faint">Already a paid Substack subscriber with a different email? Write to us and we will link it.</p>
            </>
          )}
        </Card>

        {lifetime ? <FoundingLibrary /> : null}

        <AlertSettings member={member} />

        {member && !viaSubstack ? (
          <Card>
            <CardHead icon={Mail} kicker="Paid newsletter" title="Your Substack subscription" />
            <ol className="mt-5 space-y-3">
              {steps.map((st, i) => (
                <li key={st.label} className="flex items-center gap-3">
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", st.done ? "bg-sage text-parchment" : "bg-paper text-faint ring-1 ring-rule")}>{st.done ? <Check className="size-4" /> : i + 1}</span>
                  <span className={cn("text-sm", st.done ? "text-ink" : "text-muted")}>{st.label}{st.date ? <span className="text-faint">, {longDate(st.date)}</span> : null}</span>
                  {!st.done && i === 1 ? <span className="ml-auto inline-flex items-center gap-1 text-xs text-[#6b5326]"><Clock className="size-3.5" /> Within one business day</span> : null}
                </li>
              ))}
            </ol>
            <p className="mt-5 text-xs text-faint">Uses {session.email}. {lifetime ? "Your paid subscription is comped for life." : m.status === "canceling" ? "The paid subscription ends with your membership." : "If you also pay on Substack, write to us and we will sort it out so you are not paying twice."}</p>
          </Card>
        ) : null}

        {m.isAdmin ? <SubstackTodo /> : null}
      </div>

      <aside className="flex min-w-0 flex-col gap-6">
        <Card>
          <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-ink text-parchment"><UserRound className="size-5" strokeWidth={1.75} /></span>
            <div className="min-w-0"><p className="truncate text-sm font-medium text-ink">{session.email}</p><p className="text-xs text-faint">Account since {longDate(session.createdAt)}</p></div></div>
          <div className="mt-5 flex flex-col gap-2.5 border-t border-rule pt-5 text-sm">
            <a href="/opportunities/" className="flex items-center justify-between text-ink hover:text-oxblood">Opportunities database <ArrowUpRight className="size-4" /></a>
            <button type="button" onClick={() => setPwOpen((v) => !v)} className="flex items-center justify-between text-left text-ink hover:text-oxblood">Change password <ArrowUpRight className="size-4" /></button>
            {pwOpen ? <NewPassword /> : null}
            <a href="mailto:amongtheletters@gmail.com?subject=Delete%20my%20account" className="flex items-center justify-between text-ink hover:text-oxblood">Delete my account <ArrowUpRight className="size-4" /></a>
          </div>
          <Button variant="outline" size="sm" className="mt-5 w-full" onClick={async () => { await api.signOut(); window.location.href = "/account/"; }}><LogOut className="size-4" /> Sign out</Button>
        </Card>
        <div className="rounded-xl border border-dashed border-rule p-5 text-sm text-muted">
          Questions about your membership? Write to <a href="mailto:amongtheletters@gmail.com" className="text-oxblood hover:underline">amongtheletters@gmail.com</a>.
        </div>
      </aside>
      {checkout ? <PreviewCheckout plan={plan} email={session.email} onClose={() => setCheckout(false)} /> : null}
    </div>
  );
}

export function AccountApp() {
  const [session, setSession] = useState<Session | null | undefined>(ACCOUNTS_ON ? undefined : null);
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!ACCOUNTS_ON) return;
    api.getSession().then(setSession);
    return api.onAuthChange((e, s) => { setSession(s); if (e === "PASSWORD_RECOVERY") setRecovery(true); });
  }, []);
  const reset = recovery || new URLSearchParams(window.location.search).get("reset") === "1";
  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      {MODE === "preview" ? <PreviewBar states={["visitor", "free", "member", "canceling", "substack"]} /> : null}
      <SiteHeader />
      <main className="pb-20 pt-12 md:pb-28 md:pt-16">
        <div className="section-shell">
          <div className="mb-8 max-w-2xl">
            <div className="flex items-center gap-3 text-oxblood"><UserRound className="size-5" strokeWidth={1.75} /><p className="kicker">{session ? "Your account" : "Members"}</p></div>
            <h1 className="text-on-open mt-4 font-display text-5xl font-medium tracking-tight text-ink md:text-6xl">{session ? "Everything in one place." : ACCOUNTS_ON ? "Sign in or join." : "Accounts open soon."}</h1>
          </div>
          {!ACCOUNTS_ON ? <Card className="max-w-xl"><p className="text-sm text-muted">Memberships for the opportunities database are on their way. The free listings are open now on the <a href="/opportunities/" className="text-oxblood hover:underline">database page</a>.</p></Card>
            : session === undefined ? <p className="text-sm text-faint">Loading…</p>
            : session && reset && MODE === "live" ? <NewPassword />
            : session ? <Dashboard session={session} /> : <AuthPanel />}
        </div>
      </main>
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
