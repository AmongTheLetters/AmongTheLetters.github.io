import { useCallback, useEffect, useMemo, useState } from "react";
import { LIFETIME_FINAL, RefundNote } from "@/components/refund-note";
import { ArrowUpRight, Bell, BellRing, Bookmark, BookmarkCheck, CalendarPlus, Check, Compass, Lock, LockOpen, Mail, Rss, Search, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PreviewBar } from "@/components/landing/preview-bar";
import { api, type SavedSearch } from "@/lib/backend";
import { ACCOUNTS_ON, MODE, PRICES } from "@/lib/config";
import {
  EMPTY, REGIONS, TODAY, TYPES, WINDOWS, daysUntil, describeFilters, downloadIcs, fullDate, isStub, matches, monthOnly, searchName,
  type Filters, type Item, type Opp, type SortKey, type Stub, type Win,
} from "@/lib/opportunities";
import { useAccount } from "@/lib/use-account";
import { cn } from "@/lib/utils";

const LS = { follows: "atl-opp-saved", seen: "atl-opp-last-visit" };
const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "sage" | "gold" }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "sage" ? "bg-sage/12 text-moss" : tone === "gold" ? "bg-gold/15 text-[#6b5326]" : "border border-rule bg-paper text-muted")}>{children}</span>;
}

function Countdown({ o }: { o: { deadline: string | null; opens?: string | null } }) {
  if (o.opens && o.opens > TODAY) return <span className="rounded-md bg-sage/12 px-2 py-1 text-xs font-semibold text-moss">Opens {fullDate(o.opens)}</span>;
  if (!o.deadline) return <span className="rounded-md bg-sage/12 px-2 py-1 text-xs font-semibold text-moss">Open now</span>;
  const n = daysUntil(o.deadline);
  const label = n <= 0 ? "Closes today" : n === 1 ? "1 day left" : `${n} days left`;
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", n <= 7 ? "bg-oxblood text-parchment" : n <= 30 ? "bg-gold/20 text-[#6b5326]" : "bg-paper text-muted ring-1 ring-rule")}>{label}</span>;
}

function OppCard({ o, followed, toggleFollow, isNew, lit, signedIn }: { o: Opp; followed: boolean; toggleFollow: () => void; isNew: boolean; lit: boolean; signedIn: boolean }) {
  return (
    <li id={`opp-${o.id}`} className={cn("group flex scroll-mt-28 flex-col rounded-xl bg-cream p-5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-500 hover:shadow-[var(--shadow-border-hover)]", lit && "ring-2 ring-gold ring-offset-2 ring-offset-news")}>
      {lit ? <p className="-mt-1 mb-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-[#6b5326]"><BellRing className="size-3.5" /> From your notification</p> : null}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2"><p className="kicker">{o.type}</p>{isNew ? <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b5326]">New</span> : null}</div>
        <Countdown o={o} />
      </div>
      <h3 className="mt-3 font-display text-[1.4rem] leading-tight tracking-tight text-ink">{o.title}</h3>
      <p className="mt-1 text-sm font-medium text-ink">{o.org}</p>
      <dl className="mt-3 grid gap-1 text-sm text-muted">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Deadline</dt><dd className="min-w-0">{o.deadline ? fullDate(o.deadline) : o.deadlineNote}{o.deadline && o.deadlineNote ? <span className="text-faint">, {o.deadlineNote}</span> : null}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Where</dt><dd className="min-w-0">{o.location}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Award</dt><dd className="min-w-0">{o.award}</dd></div>
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-muted">{o.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {o.genres.slice(0, 3).map((g) => <Chip key={g} tone="sage">{g}</Chip>)}
        <Chip tone={o.fee === "Free" ? "gold" : "plain"}>{o.fee === "Free" ? "Free to enter" : o.fee === "Fee" ? "Entry fee" : "Check fee"}</Chip>
      </div>
      <div className="mt-auto pt-4"><div className="flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <Button asChild size="sm"><a href={o.url} target="_blank" rel="noopener noreferrer">Official page <ArrowUpRight className="size-4" /></a></Button>
        {o.deadline ? <Button size="sm" variant="outline" onClick={() => downloadIcs([o], `${o.id}.ics`)}><CalendarPlus className="size-4" /> Remind me</Button> : null}
        <button type="button" onClick={toggleFollow} aria-pressed={followed} title={signedIn ? (followed ? "Following, we will tell you before it closes" : "Follow for closing reminders") : followed ? "Saved on this device" : "Save"}
          aria-label={followed ? "Unfollow" : "Follow"} className={cn("ml-auto inline-flex size-9 items-center justify-center rounded-md transition-colors", followed ? "bg-oxblood/10 text-oxblood" : "text-faint hover:bg-paper hover:text-ink")}>
          {followed ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-faint">Checked against the official page {fullDate(o.verified)}</p></div>
    </li>
  );
}

function LockedCard({ s, onUnlock, lit }: { s: Stub; onUnlock: () => void; lit: boolean }) {
  return (
    <li id={`opp-${s.id}`} className={cn("relative flex scroll-mt-28 flex-col overflow-hidden rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]", lit && "ring-2 ring-gold ring-offset-2 ring-offset-news")}>
      <div className="flex items-center justify-between gap-3"><p className="kicker">{s.type}</p><span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-semibold text-parchment"><Lock className="size-3" /> Members</span></div>
      <div aria-hidden="true" className="mt-4 select-none space-y-2 blur-[3px]">
        <div className="h-5 w-4/5 rounded bg-ink/20" /><div className="h-5 w-3/5 rounded bg-ink/20" /><div className="mt-3 h-3.5 w-2/5 rounded bg-ink/12" />
        <div className="h-3 w-full rounded bg-ink/8" /><div className="h-3 w-11/12 rounded bg-ink/8" /><div className="h-3 w-3/4 rounded bg-ink/8" />
      </div>
      <dl className="mt-4 grid gap-1 text-sm text-muted">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Deadline</dt><dd>{s.deadline ? monthOnly(s.deadline) : "Rolling"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Region</dt><dd>{s.region}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">{s.genres.slice(0, 3).map((g) => <Chip key={g} tone="sage">{g}</Chip>)}{s.fee === "Free" ? <Chip tone="gold">Free to enter</Chip> : null}</div>
      <div className="mt-auto pt-4"><div className="border-t border-rule pt-4">
        <Button size="sm" variant="ink" onClick={onUnlock}><Lock className="size-4" /> {ACCOUNTS_ON ? "Join to unlock" : "Members only"}</Button>
      </div></div>
    </li>
  );
}

export function OpportunitiesApp() {
  const { ready, session, member } = useAccount();
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ total: 0, free: 0 });
  const [f, setF] = useState<Filters>(EMPTY);
  const [follows, setFollows] = useState<string[]>(() => read(LS.follows, []));
  const [searches, setSearches] = useState<SavedSearch[]>([]);
  const [activeSearch, setActiveSearch] = useState<string | null>(null);
  const [lit, setLit] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [lastVisit] = useState<string>(() => read(LS.seen, TODAY));

  useEffect(() => {
    if (!ready) return;
    api.loadListings(member).then((d) => { setItems(d.items); setMeta({ total: d.total, free: d.free }); }).catch(() => undefined);
    if (session) api.listFollows().then(setFollows).catch(() => undefined);
    if (member) api.listSearches().then(setSearches).catch(() => undefined);
    const t = setTimeout(() => write(LS.seen, TODAY), 4000);
    return () => clearTimeout(t);
  }, [ready, session, member]);

  /* deep links: ?s=<saved search id> applies its filters, ?o=<listing id> scrolls to and highlights a listing */
  const applyDeepLink = useCallback(() => {
    const p = new URLSearchParams(window.location.search);
    const sid = p.get("s"), oid = p.get("o");
    const s = sid ? searches.find((x) => x.id === sid) : undefined;
    if (s) { setF({ ...EMPTY, ...s.filters, savedOnly: false }); setActiveSearch(s.id); }
    else if (oid) { setF(EMPTY); setActiveSearch(null); }
    if (oid) {
      setLit(oid);
      setTimeout(() => document.getElementById(`opp-${oid}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 150);
      setTimeout(() => setLit((x) => (x === oid ? null : x)), 6000);
    }
  }, [searches]);
  useEffect(() => { if (items.length) applyDeepLink(); }, [items.length, applyDeepLink]);
  useEffect(() => {
    const h = () => applyDeepLink();
    window.addEventListener("atl:deeplink", h); window.addEventListener("popstate", h);
    return () => { window.removeEventListener("atl:deeplink", h); window.removeEventListener("popstate", h); };
  }, [applyDeepLink]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setActiveSearch(null); setF((p) => ({ ...p, [k]: v })); };
  const toggleFollow = (id: string) => setFollows((p) => {
    const on = !p.includes(id); const n = on ? [...p, id] : p.filter((x) => x !== id);
    if (session) api.follow(id, on).catch(() => undefined); else write(LS.follows, n);
    if (on && member) flash("Following. We will tell you here before it closes.");
    return n;
  });
  const join = () => { if (!ACCOUNTS_ON) return; window.location.href = session ? "/account/#join" : "/account/?mode=signup&next=join"; };

  const genres = useMemo(() => Array.from(new Set(items.flatMap((i) => i.genres))).sort(), [items]);
  const typeCounts = useMemo(() => TYPES.map((t) => [t, items.filter((i) => i.type === t).length] as const).filter(([, n]) => n), [items]);
  const filtered = useMemo(() => {
    const list = items.filter((i) => matches(i, f, follows));
    const dk = (i: Item) => i.deadline ? (i.deadline.length === 7 ? `${i.deadline}-28` : i.deadline) : "9999";
    return list.sort((a, b) => f.sort === "added" ? b.added.localeCompare(a.added) || dk(a).localeCompare(dk(b))
      : f.sort === "name" ? (isStub(a) ? "~" : a.title).localeCompare(isStub(b) ? "~" : b.title)
      : dk(a).localeCompare(dk(b)) || (isStub(a) ? 1 : 0) - (isStub(b) ? 1 : 0));
  }, [items, f, follows]);

  const open = filtered.filter((i): i is Opp => !isStub(i));
  const lockedCount = filtered.length - open.length;
  const closingSoon = items.filter((i) => i.deadline && i.deadline.length === 10 && daysUntil(i.deadline) >= 0 && daysUntil(i.deadline) <= 14).length;
  const newCount = items.filter((i) => i.added > lastVisit).length;
  const filtersOn = f.q || f.type !== "All" || f.region !== "All regions" || f.genre !== "All genres" || f.win !== "any" || f.freeOnly || f.savedOnly;
  const current = searches.find((s) => s.id === activeSearch) ?? searches.find((s) => JSON.stringify({ ...EMPTY, ...s.filters, savedOnly: false, sort: f.sort }) === JSON.stringify({ ...f, savedOnly: false }));

  async function saveSearch() {
    if (!member) { join(); return; }
    try { const s = await api.createSearch(searchName(f), f); setSearches((p) => [...p, s]); setActiveSearch(s.id); flash("Search saved. New matches will appear in your notifications."); }
    catch { flash("That search could not be saved. Please try again."); }
  }

  const selectCls = "mt-1 h-10 w-full rounded-md border border-rule bg-cream px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to the opportunities</a>
      {MODE === "preview" ? <PreviewBar states={["visitor", "free", "member", "founding"]} /> : null}
      <SiteHeader />

      <main>
        <section className="pb-8 pt-12 md:pb-10 md:pt-16">
          <div className="section-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 text-oxblood"><Compass className="size-5" strokeWidth={1.75} /><p className="kicker">Opportunities</p></div>
              <h1 className="text-on-open mt-4 font-display text-5xl font-medium tracking-tight text-ink md:text-6xl">Somewhere worth sending your work.</h1>
              <p className="text-on-open mt-4 max-w-xl text-lead text-muted">Contests, calls, grants, residencies, fellowships and paid markets, each one checked against its official page and sorted by deadline.</p>
            </div>
            <div className="grid min-w-0 grid-cols-3 divide-x divide-rule rounded-xl bg-cream shadow-[var(--shadow-border)] lg:w-[26rem]">
              {([[meta.total || items.length, "open now"], [closingSoon, "close in 14 days"], [newCount || meta.total - meta.free, newCount ? "new since you visited" : "for members"]] as const).map(([n, l]) => (
                <div key={l} className="p-4 text-center"><p className="font-display text-3xl tracking-tight text-ink">{n}</p><p className="mt-1 text-xs leading-snug text-muted">{l}</p></div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="section-shell">
            <div className={cn("flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between", member ? "bg-sage/10 ring-1 ring-sage/25" : "bg-ink text-parchment")}>
              {member ? (
                <>
                  <p className="flex items-center gap-3 text-sm text-ink"><LockOpen className="size-5 shrink-0 text-moss" /> Signed in as {session?.email}. Every listing is open, and your alerts arrive in the bell above.</p>
                  <Button asChild size="sm" variant="outline"><a href="/account/"><UserRound className="size-4" /> My account</a></Button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-5 shrink-0 text-gold-soft" />
                    <div><p className="font-display text-xl tracking-tight">{meta.free} listings are free. Members see all {meta.total}.</p>
                      <p className="mt-1 text-sm text-parchment/75">{!ACCOUNTS_ON ? "Memberships open soon." : session ? "You are signed in with a free account. Membership opens everything and includes the paid newsletter." : "Membership opens every listing, adds alerts and includes the paid newsletter on Substack."}</p></div>
                  </div>
                  {ACCOUNTS_ON ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button size="sm" className="bg-gold text-ink hover:bg-gold-soft" onClick={join}>Become a member</Button>
                      {session ? null : <Button asChild size="sm" variant="outline"><a href="/account/">Sign in</a></Button>}
                      <a href="/membership/" className="inline-flex h-9 items-center px-2 text-sm font-medium text-parchment/85 underline-offset-4 hover:text-parchment hover:underline">Compare plans</a>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            {member && searches.length ? (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium text-muted"><Bell className="size-4" /> Your saved searches</span>
                {searches.map((s) => (
                  <button key={s.id} type="button" onClick={() => { setF({ ...EMPTY, ...s.filters, savedOnly: false }); setActiveSearch(s.id); }}
                    className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", current?.id === s.id ? "bg-ink text-parchment" : "bg-cream text-ink shadow-[var(--shadow-border)] hover:bg-paper")}>{s.name}</button>
                ))}
                <a href="/account/#alerts" className="text-sm text-oxblood hover:underline">Alert settings</a>
              </div>
            ) : null}

            <div className="mt-5 rounded-xl bg-cream p-4 shadow-[var(--shadow-border)] sm:p-5">
              <div className="flex flex-wrap gap-2" role="group" aria-label="Opportunity type">
                {([["All", items.length], ...typeCounts] as const).map(([t, n]) => (
                  <button key={t} type="button" aria-pressed={f.type === t} onClick={() => set("type", t)}
                    className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", f.type === t ? "bg-oxblood text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}>
                    {t === "All" ? "Everything" : t} <span className={cn("ml-1 text-xs", f.type === t ? "text-parchment/70" : "text-faint")}>{n}</span>
                  </button>
                ))}
              </div>
              <label className="relative mt-4 block">
                <span className="sr-only">Search opportunities</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                <input value={f.q} onChange={(e) => set("q", e.target.value)} placeholder={member ? "Search by name, place, genre or eligibility" : "Search the free listings"} className="h-11 w-full rounded-md border border-rule bg-cream pl-9 pr-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood" />
              </label>
              <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                <label className="text-xs font-medium text-muted">Deadline<select value={f.win} onChange={(e) => set("win", e.target.value as Win)} className={selectCls}>{WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="text-xs font-medium text-muted">Region<select value={f.region} onChange={(e) => set("region", e.target.value)} className={selectCls}><option>All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
                <label className="text-xs font-medium text-muted">Genre<select value={f.genre} onChange={(e) => set("genre", e.target.value)} className={selectCls}><option>All genres</option>{genres.map((g) => <option key={g}>{g}</option>)}</select></label>
                <label className="text-xs font-medium text-muted">Sort<select value={f.sort} onChange={(e) => setF((p) => ({ ...p, sort: e.target.value as SortKey }))} className={selectCls}><option value="deadline">Deadline, soonest first</option><option value="added">Newest added</option><option value="name">Name, A to Z</option></select></label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={f.freeOnly} onClick={() => set("freeOnly", !f.freeOnly)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", f.freeOnly ? "bg-ink text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}>Free to enter</button>
                <button type="button" aria-pressed={f.savedOnly} onClick={() => set("savedOnly", !f.savedOnly)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", f.savedOnly ? "bg-ink text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}><Bookmark className="size-3.5" /> {session ? "Following" : "Saved"} {follows.length ? `(${follows.length})` : ""}</button>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  {filtersOn ? <button type="button" onClick={() => { setActiveSearch(null); setF((p) => ({ ...EMPTY, sort: p.sort })); }} className="inline-flex items-center gap-1 text-sm font-medium text-oxblood hover:underline"><X className="size-4" /> Clear filters</button> : null}
                  {current ? <span className="inline-flex items-center gap-1.5 text-sm text-moss"><Check className="size-4" /> Saved search, alerts on</span>
                    : ACCOUNTS_ON ? <button type="button" onClick={saveSearch} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-oxblood"><Bell className="size-4" /> {member ? "Save this search and alert me" : "Save this search"}</button> : null}
                </div>
              </div>
            </div>

            <div id="results" className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-faint" aria-live="polite">{open.length} open {open.length === 1 ? "listing" : "listings"}{lockedCount ? ` and ${lockedCount} for members` : ""}{filtersOn ? ` match ${describeFilters(f).join(", ")}` : ""}</p>
              {open.some((o) => o.deadline) ? <Button size="sm" variant="outline" onClick={() => downloadIcs(open, "atl-opportunities.ics")}><CalendarPlus className="size-4" /> Add these deadlines to my calendar</Button> : null}
            </div>
            {filtered.length ? (
              <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((i) => isStub(i) ? <LockedCard key={i.id} s={i} onUnlock={join} lit={lit === i.id} />
                  : <OppCard key={i.id} o={i} followed={follows.includes(i.id)} toggleFollow={() => toggleFollow(i.id)} isNew={i.added > lastVisit} lit={lit === i.id} signedIn={!!session} />)}
              </ul>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">{f.q && !member ? "Search covers the free listings until you join." : "Nothing matches those filters yet."}</p>
                <button type="button" onClick={() => setF(EMPTY)} className="mt-3 text-sm font-medium text-oxblood hover:underline">Clear filters</button>
              </div>
            )}

            <div className="mt-16">
              <p className="kicker">Alerts</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">Hear about it before it closes.</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  [BellRing, "Notifications on the site", "New matches for your saved searches and reminders for listings you follow, in the bell at the top of every page.", true],
                  [Mail, "Email, if you want it", "Turn on email for any saved search, as it happens, daily or weekly. Off unless you choose it.", true],
                  [CalendarPlus, "Your deadline calendar", "A private calendar link for Google, Apple or Outlook that follows the listings you follow.", true],
                  [Rss, "RSS feed", "Follow the free listings in any feed reader as soon as they are added.", false],
                ] as const).map(([Icon, t, b, paid]) => (
                  <div key={t} className="flex flex-col rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
                    <div className="flex items-center justify-between">
                      <span className="flex size-10 items-center justify-center rounded-full bg-oxblood/10 text-oxblood"><Icon className="size-5" strokeWidth={1.75} /></span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", paid ? "bg-ink text-parchment" : "bg-sage/12 text-moss")}>{paid ? "Members" : "Free"}</span>
                    </div>
                    <h3 className="mt-4 font-display text-xl tracking-tight text-ink">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                    <div className="mt-auto pt-4">
                      {!paid ? <a href="/opportunities/feed.xml" className="text-sm font-medium text-oxblood hover:underline">Open the feed <ArrowUpRight className="inline size-3.5" /></a>
                        : member ? <a href="/account/#alerts" className="text-sm font-medium text-oxblood hover:underline">Alert settings <ArrowUpRight className="inline size-3.5" /></a>
                        : ACCOUNTS_ON ? <button type="button" onClick={join} className="text-sm font-medium text-oxblood hover:underline">Join to turn on <ArrowUpRight className="inline size-3.5" /></button>
                        : <span className="text-sm text-faint">Opening soon</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {member ? null : (
              <div id="join" className="mt-16 scroll-mt-24">
                <p className="kicker">Membership</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">One membership, everything open.</h2>
                <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                  <div className="flex flex-col rounded-xl bg-cream p-6 shadow-[var(--shadow-border)]">
                    <p className="kicker kicker-sage">Free</p>
                    <p className="mt-3 font-display text-4xl tracking-tight text-ink">$0</p>
                    <ul className="mt-4 space-y-2 text-sm text-muted">{["The listings from the free half of each Monday email", "Filters, bookmarks and one-off calendar reminders", "RSS feed of free listings"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-moss" />{x}</li>)}</ul>
                    <div className="mt-auto pt-6">{!ACCOUNTS_ON ? null : session ? <p className="text-sm text-moss">You have a free account.</p> : <Button asChild variant="outline" className="w-full"><a href="/account/?mode=signup">Create a free account</a></Button>}</div>
                  </div>
                  <div className="relative flex flex-col rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)]">
                    <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-ink"><Sparkles className="size-3" /> Includes the paid newsletter</span>
                    <p className="kicker kicker-inverse">Member</p>
                    <p className="mt-3 font-display text-4xl tracking-tight">{PRICES.monthly.label}<span className="text-lg text-parchment/70"> {PRICES.monthly.per}</span></p>
                    <p className="text-sm text-parchment/70">or {PRICES.annual.label} {PRICES.annual.per}, two months free</p>
                    <p className="text-sm text-parchment/70">or {PRICES.lifetime.label} {PRICES.lifetime.per} as a founding member, with every guide PDF and future product included</p>
                    <ul className="mt-4 grid gap-2 text-sm text-parchment/85 sm:grid-cols-2">{["Every listing in the database", "Notifications for saved searches", "Closing reminders for listings you follow", "A paid Substack subscription to every issue", "Full Monday Morning Opportunities", "Cancel any time from your account"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold-soft" />{x}</li>)}</ul>
                    <p className="mt-4 text-xs text-parchment/60">Already a paid Substack subscriber? Make an account with the same email and everything opens at no extra cost.</p>
                    <div className="mt-auto pt-6"><Button className="w-full bg-gold text-ink hover:bg-gold-soft" onClick={join} disabled={!ACCOUNTS_ON}>{ACCOUNTS_ON ? "Become a member" : "Memberships open soon"}</Button></div>
                  </div>
                </div>
                <RefundNote className="mt-4 text-sm" />
                <p className="mt-1 text-sm text-faint">{LIFETIME_FINAL}</p>
                <p className="mt-2 text-sm text-faint"><a href="/membership/" className="font-medium text-oxblood hover:underline">Compare plans and read the membership terms</a></p>
                <p className="mt-2 text-sm text-faint">Prices in Canadian dollars. Details can change after a listing is added, so confirm deadlines, eligibility and fees on each official page before you apply.</p>
              </div>
            )}
          </div>
        </section>
      </main>

      {toast ? <div role="status" className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit max-w-[calc(100vw-2rem)] rounded-full bg-ink px-5 py-2.5 text-sm text-parchment shadow-xl">{toast}</div> : null}
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <FlierPopup />
    </div>
  );
}
