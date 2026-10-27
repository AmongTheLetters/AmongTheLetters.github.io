import { useCallback, useEffect, useMemo, useState } from "react";
import { LIFETIME_FINAL, RefundNote } from "@/components/refund-note";
import { ArrowUp, ArrowUpRight, Bell, BellRing, Bookmark, BookmarkCheck, CalendarPlus, Check, ChevronDown, Compass, Lock, LockOpen, Mail, Rss, Search, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PreviewBar } from "@/components/landing/preview-bar";
import { api, type SavedSearch } from "@/lib/backend";
import { ACCOUNTS_ON, MODE, PRICES } from "@/lib/config";
import {
  EMPTY, REGIONS, TODAY, TYPES, WINDOWS, daysUntil, describeFilters, downloadIcs, expectedLabel, fullDate, isStub, matches, monthOnly, searchName,
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

function Countdown({ o }: { o: { deadline: string | null; opens?: string | null; expected?: string | null; recurrence?: string } }) {
  if (o.expected) return <span className="rounded-md bg-paper px-2 py-1 text-xs font-semibold text-muted ring-1 ring-rule">Expected {monthOnly(o.expected)}</span>;
  if (o.opens && o.opens > TODAY) return <span className="rounded-md bg-sage/12 px-2 py-1 text-xs font-semibold text-moss">Opens {fullDate(o.opens)}</span>;
  if (!o.deadline) return o.recurrence === "rolling" || !o.recurrence
    ? <span className="rounded-md bg-sage/12 px-2 py-1 text-xs font-semibold text-moss">Open now</span>
    : <span className="rounded-md bg-paper px-2 py-1 text-xs font-semibold text-muted ring-1 ring-rule">See dates</span>;
  const n = daysUntil(o.deadline);
  const label = n <= 0 ? "Closes today" : n === 1 ? "1 day left" : `${n} days left`;
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", n <= 7 ? "bg-oxblood text-parchment" : n <= 30 ? "bg-gold/20 text-[#6b5326]" : "bg-paper text-muted ring-1 ring-rule")}>{label}</span>;
}

const PAGE = 20;
const SOON_DAYS = 30;
/** Comparable date for sorting and grouping. Month-only deadlines count as late in the month. */
const dueKey = (i: Item) => i.deadline ? (i.deadline.length === 7 ? `${i.deadline}-28` : i.deadline) : i.expected ? `${i.expected}-29` : "9999";
/** Closing soon needs an exact date, so month-only deadlines (members teasers) stay in the main list. */
const isSoon = (i: Item) => { if (!i.deadline || i.deadline.length !== 10) return false; const n = daysUntil(i.deadline); return n >= 0 && n <= SOON_DAYS; };

function TierTag({ i }: { i: Item }) {
  return isStub(i) || i.tier === "members"
    ? <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-ink px-2 py-0.5 text-[11px] font-semibold text-parchment">{isStub(i) ? <Lock className="size-3" /> : <LockOpen className="size-3" />} Members</span>
    : <span className="shrink-0 rounded-md bg-sage/15 px-2 py-0.5 text-[11px] font-semibold text-moss">Free</span>;
}

function dueText(i: Item) {
  if (i.expected) return `Expected ${monthOnly(i.expected)}`;
  if (!i.deadline) return isStub(i) ? "Rolling" : (i.deadlineNote || "Rolling");
  return isStub(i) || i.deadline.length === 7 ? monthOnly(i.deadline) : fullDate(i.deadline);
}

type CardProps = { i: Item; expanded: boolean; onToggle: () => void; lit: boolean; isNew: boolean; followed: boolean; toggleFollow: () => void; signedIn: boolean; onUnlock: () => void };

/* One listing. Collapsed it shows the type, name, deadline and the Free or Members tag. Tapping it opens the full
   details, or for a locked members listing the same teaser and join button as before. */
function ListingCard({ i, expanded, onToggle, lit, isNew, followed, toggleFollow, signedIn, onUnlock }: CardProps) {
  const panel = `opp-${i.id}-details`;
  const stub = isStub(i);
  return (
    <li id={`opp-${i.id}`} className={cn("scroll-mt-48 rounded-xl bg-cream shadow-[var(--shadow-border)] transition-[box-shadow] duration-500 hover:shadow-[var(--shadow-border-hover)]", lit && "ring-2 ring-gold ring-offset-2 ring-offset-news")}>
      {lit ? <p className="mx-4 mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/20 px-2.5 py-0.5 text-xs font-semibold text-[#6b5326]"><BellRing className="size-3.5" /> From your notification</p> : null}
      <button type="button" onClick={onToggle} aria-expanded={expanded} aria-controls={panel}
        className="flex w-full items-start gap-3 rounded-xl p-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-oxblood">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="kicker">{i.type}</span>
            {isNew ? <span className="rounded bg-gold/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b5326]">New</span> : null}
          </span>
          {stub ? (
            <span className="mt-1.5 flex items-center gap-2 font-display text-lg leading-snug tracking-tight text-muted"><Lock className="size-4 shrink-0 text-faint" /> Members only listing</span>
          ) : (
            <span className="mt-1.5 block font-display text-lg leading-snug tracking-tight text-ink">{i.title}</span>
          )}
          <span className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
            {i.deadline && i.deadline.length === 7 ? null : <Countdown o={i} />}
            <span>{dueText(i)}</span>
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-3">
          <TierTag i={i} />
          <ChevronDown className={cn("size-5 text-faint transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true" />
          <span className="sr-only">{expanded ? "Hide details" : "Show details"}</span>
        </span>
      </button>
      {expanded ? (
        <div id={panel} className="border-t border-rule px-4 pb-4 pt-3">
          {stub ? <LockedDetails s={i} onUnlock={onUnlock} /> : <OppDetails o={i} followed={followed} toggleFollow={toggleFollow} signedIn={signedIn} />}
        </div>
      ) : null}
    </li>
  );
}

function OppDetails({ o, followed, toggleFollow, signedIn }: { o: Opp; followed: boolean; toggleFollow: () => void; signedIn: boolean }) {
  return (
    <>
      <p className="text-sm font-medium text-ink">{o.org}</p>
      <dl className="mt-3 grid gap-1 text-sm text-muted">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Deadline</dt><dd className="min-w-0">{o.expected ? expectedLabel(o.expected) : o.deadline ? fullDate(o.deadline) : o.deadlineNote}{o.deadline && o.deadlineNote ? <span className="text-faint">, {o.deadlineNote}</span> : null}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Where</dt><dd className="min-w-0">{o.location}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Award</dt><dd className="min-w-0">{o.award}</dd></div>
        {o.paysWriter && o.payRate && o.payRate !== o.award ? <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Pay</dt><dd className="min-w-0">{o.payRate}</dd></div> : null}
      </dl>
      <p className="mt-3 text-sm leading-relaxed text-muted">{o.summary}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {o.genres.slice(0, 3).map((g) => <Chip key={g} tone="sage">{g}</Chip>)}
        <Chip tone={o.fee === "Free" ? "gold" : "plain"}>{o.fee === "Free" ? "Free to enter" : o.fee === "Fee" ? "Entry fee" : "Check fee"}</Chip>
        {o.paysWriter ? <Chip tone="gold">Pays writers</Chip> : null}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-rule pt-4">
        <Button asChild size="sm"><a href={o.url} target="_blank" rel="noopener noreferrer">Official page <ArrowUpRight className="size-4" /></a></Button>
        {o.deadline ? <Button size="sm" variant="outline" onClick={() => downloadIcs([o], `${o.id}.ics`)}><CalendarPlus className="size-4" /> Remind me</Button> : null}
        <button type="button" onClick={toggleFollow} aria-pressed={followed} title={signedIn ? (followed ? "Following, we will tell you before it closes" : "Follow for closing reminders") : followed ? "Saved on this device" : "Save"}
          aria-label={followed ? "Unfollow" : "Follow"} className={cn("ml-auto inline-flex size-9 items-center justify-center rounded-md transition-colors", followed ? "bg-oxblood/10 text-oxblood" : "text-faint hover:bg-paper hover:text-ink")}>
          {followed ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-faint">Checked against the official page {fullDate(o.verified)}</p>
    </>
  );
}

function LockedDetails({ s, onUnlock }: { s: Stub; onUnlock: () => void }) {
  return (
    <>
      <div aria-hidden="true" className="select-none space-y-2 blur-[3px]">
        <div className="h-5 w-4/5 rounded bg-ink/20" /><div className="h-5 w-3/5 rounded bg-ink/20" /><div className="mt-3 h-3.5 w-2/5 rounded bg-ink/12" />
        <div className="h-3 w-full rounded bg-ink/8" /><div className="h-3 w-11/12 rounded bg-ink/8" /><div className="h-3 w-3/4 rounded bg-ink/8" />
      </div>
      <dl className="mt-4 grid gap-1 text-sm text-muted">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Deadline</dt><dd>{s.expected ? `Expected ${monthOnly(s.expected)}` : s.deadline ? monthOnly(s.deadline) : "Rolling"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Region</dt><dd>{s.region}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">{s.genres.slice(0, 3).map((g) => <Chip key={g} tone="sage">{g}</Chip>)}{s.fee === "Free" ? <Chip tone="gold">Free to enter</Chip> : null}{s.paysWriter ? <Chip tone="gold">Pays writers</Chip> : null}</div>
      <div className="mt-4 border-t border-rule pt-4">
        <Button size="sm" variant="ink" onClick={onUnlock}><Lock className="size-4" /> {ACCOUNTS_ON ? "Join to unlock" : "Members only"}</Button>
      </div>
    </>
  );
}

function ChipButton({ on, onClick, children, count }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors", on ? "bg-oxblood text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}>
      {children}{count !== undefined ? <span className={cn("ml-1.5 text-xs", on ? "text-parchment/70" : "text-faint")}>{count}</span> : null}
    </button>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > 900);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  if (!show) return null;
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <button type="button" aria-label="Back to top" onClick={() => { window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); }}
      className="fixed bottom-5 right-4 z-40 inline-flex size-12 items-center justify-center rounded-full bg-ink text-parchment shadow-xl transition-colors hover:bg-oxblood focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood sm:right-6">
      <ArrowUp className="size-5" />
    </button>
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
  const [limit, setLimit] = useState(PAGE);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const toggleOpen = (id: string) => setExpanded((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

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
    const dk = dueKey;
    return list.sort((a, b) => f.sort === "added" ? b.added.localeCompare(a.added) || dk(a).localeCompare(dk(b))
      : f.sort === "name" ? (isStub(a) ? "~" : a.title).localeCompare(isStub(b) ? "~" : b.title)
      : dk(a).localeCompare(dk(b)) || (isStub(a) ? 1 : 0) - (isStub(b) ? 1 : 0));
  }, [items, f, follows]);

  /* Soonest deadline first, with a closing soon group on top. Only the first `limit` listings are drawn. */
  const grouped = f.sort === "deadline";
  const soon = grouped ? filtered.filter(isSoon) : [];
  const ordered = grouped ? [...soon, ...filtered.filter((i) => !isSoon(i))] : filtered;
  const visible = ordered.slice(0, limit);
  const visibleSoon = visible.slice(0, Math.min(soon.length, visible.length));
  const visibleRest = visible.slice(visibleSoon.length);
  useEffect(() => { setLimit(PAGE); }, [f]);
  useEffect(() => {
    if (!lit) return;
    setExpanded((p) => (p.has(lit) ? p : new Set(p).add(lit)));
    const idx = ordered.findIndex((i) => i.id === lit);
    if (idx >= limit) setLimit(Math.ceil((idx + 1) / PAGE) * PAGE);
  }, [lit, ordered, limit]);
  const moreCount = (f.win !== "any" ? 1 : 0) + (f.genre !== "All genres" ? 1 : 0) + (f.freeOnly ? 1 : 0) + (f.paysOnly ? 1 : 0) + (f.savedOnly ? 1 : 0) + (f.sort !== "deadline" ? 1 : 0);
  const regionCounts = useMemo(() => REGIONS.map((r) => [r, items.filter((i) => i.region === r).length] as const).filter(([, n]) => n), [items]);

  const open = filtered.filter((i): i is Opp => !isStub(i));
  const lockedCount = filtered.length - open.length;
  const closingSoon = items.filter((i) => i.deadline && i.deadline.length === 10 && daysUntil(i.deadline) >= 0 && daysUntil(i.deadline) <= 14).length;
  const newCount = items.filter((i) => i.added > lastVisit).length;
  const filtersOn = f.q || f.type !== "All" || f.region !== "All regions" || f.genre !== "All genres" || f.win !== "any" || f.freeOnly || f.paysOnly || f.savedOnly;
  const current = searches.find((s) => s.id === activeSearch) ?? searches.find((s) => JSON.stringify({ ...EMPTY, ...s.filters, savedOnly: false, sort: f.sort }) === JSON.stringify({ ...f, savedOnly: false }));

  async function saveSearch() {
    if (!member) { join(); return; }
    try { const s = await api.createSearch(searchName(f), f); setSearches((p) => [...p, s]); setActiveSearch(s.id); flash("Search saved. New matches will appear in your notifications."); }
    catch { flash("That search could not be saved. Please try again."); }
  }

  const renderCard = (i: Item) => (
    <ListingCard key={i.id} i={i} expanded={expanded.has(i.id)} onToggle={() => toggleOpen(i.id)} lit={lit === i.id} isNew={i.added > lastVisit}
      followed={follows.includes(i.id)} toggleFollow={() => toggleFollow(i.id)} signedIn={!!session} onUnlock={join} />
  );
  const selectCls = "mt-1 h-11 w-full rounded-md border border-rule bg-cream px-3 text-base text-ink sm:h-10 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";

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

            <div>
            <div className="sticky top-16 z-20 -mx-4 mt-5 border-b border-rule bg-cream/95 px-4 py-3 shadow-[var(--shadow-border)] backdrop-blur supports-[backdrop-filter]:bg-cream/90 sm:mx-0 sm:rounded-xl sm:border-b-0 sm:p-4">
              <div className="flex gap-2">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Search opportunities</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                  <input id="opp-search" type="search" value={f.q} onChange={(e) => set("q", e.target.value)} placeholder={member ? "Search name, place, genre" : "Search the free listings"} enterKeyHint="search"
                    className="h-11 w-full rounded-md border border-rule bg-paper pl-9 pr-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood sm:text-sm" />
                </label>
                <button type="button" aria-expanded={moreOpen} aria-controls="opp-more-filters" onClick={() => setMoreOpen((v) => !v)}
                  className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors", moreOpen || moreCount ? "bg-ink text-parchment" : "border border-rule bg-paper text-ink hover:bg-cream")}>
                  <SlidersHorizontal className="size-4" /> <span>Filters</span>
                  {moreCount ? <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold leading-5 text-ink" aria-label={`${moreCount} more filters on`}>{moreCount}</span> : null}
                </button>
              </div>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Opportunity type">
                {([["All", items.length], ...typeCounts] as const).map(([t, n]) => (
                  <ChipButton key={t} on={f.type === t} onClick={() => set("type", t)} count={n}>{t === "All" ? "Everything" : t}</ChipButton>
                ))}
              </div>
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Region">
                {([["All regions", items.length], ...regionCounts] as const).map(([r, n]) => (
                  <ChipButton key={r} on={f.region === r} onClick={() => set("region", r)} count={n}>{r === "All regions" ? "Anywhere" : r}</ChipButton>
                ))}
              </div>
              {moreOpen ? (
                <div id="opp-more-filters" className="mt-3 max-h-[55vh] overflow-y-auto border-t border-rule pt-3">
                  <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-3">
                    <label className="text-xs font-medium text-muted">Deadline<select value={f.win} onChange={(e) => set("win", e.target.value as Win)} className={selectCls}>{WINDOWS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                    <label className="text-xs font-medium text-muted">Genre<select value={f.genre} onChange={(e) => set("genre", e.target.value)} className={selectCls}><option>All genres</option>{genres.map((g) => <option key={g}>{g}</option>)}</select></label>
                    <label className="text-xs font-medium text-muted">Sort<select value={f.sort} onChange={(e) => setF((p) => ({ ...p, sort: e.target.value as SortKey }))} className={selectCls}><option value="deadline">Deadline, soonest first</option><option value="added">Newest added</option><option value="name">Name, A to Z</option></select></label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <ChipButton on={f.freeOnly} onClick={() => set("freeOnly", !f.freeOnly)}>Free to enter</ChipButton>
                    <ChipButton on={f.paysOnly} onClick={() => set("paysOnly", !f.paysOnly)}>Pays writers</ChipButton>
                    <ChipButton on={f.savedOnly} onClick={() => set("savedOnly", !f.savedOnly)}><Bookmark className="mr-1.5 size-3.5" /> {session ? "Following" : "Saved"} {follows.length ? `(${follows.length})` : ""}</ChipButton>
                  </div>
                </div>
              ) : null}
            </div>

            <div id="results" className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-faint" aria-live="polite">{open.length} open {open.length === 1 ? "listing" : "listings"}{lockedCount ? ` and ${lockedCount} for members` : ""}{filtersOn ? ` match ${describeFilters(f).join(", ")}` : ""}</p>
              <div className="flex flex-wrap items-center gap-3">
                {filtersOn ? <button type="button" onClick={() => { setActiveSearch(null); setF((p) => ({ ...EMPTY, sort: p.sort })); }} className="inline-flex items-center gap-1 text-sm font-medium text-oxblood hover:underline"><X className="size-4" /> Clear filters</button> : null}
                {current ? <span className="inline-flex items-center gap-1.5 text-sm text-moss"><Check className="size-4" /> Saved search, alerts on</span>
                  : ACCOUNTS_ON ? <button type="button" onClick={saveSearch} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-oxblood"><Bell className="size-4" /> {member ? "Save this search and alert me" : "Save this search"}</button> : null}
                {open.some((o) => o.deadline) ? <Button size="sm" variant="outline" onClick={() => downloadIcs(open, "atl-opportunities.ics")}><CalendarPlus className="size-4" /> Add these deadlines to my calendar</Button> : null}
              </div>
            </div>
            {filtered.length ? (
              <>
                {visibleSoon.length ? (
                  <section aria-labelledby="soon-h" className="mt-4">
                    <h2 id="soon-h" className="flex items-baseline gap-2 font-display text-2xl tracking-tight text-ink">Closing soon <span className="font-sans text-sm font-normal text-faint">{soon.length} in the next {SOON_DAYS} days</span></h2>
                    <ul className="mt-3 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleSoon.map(renderCard)}</ul>
                  </section>
                ) : null}
                {visibleRest.length ? (
                  <section aria-labelledby="rest-h" className={visibleSoon.length ? "mt-10" : "mt-4"}>
                    {grouped && soon.length ? <h2 id="rest-h" className="font-display text-2xl tracking-tight text-ink">Later and rolling</h2> : <h2 id="rest-h" className="sr-only">Listings</h2>}
                    <ul className="mt-3 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleRest.map(renderCard)}</ul>
                  </section>
                ) : null}
                <div className="mt-6 flex flex-col items-center gap-2">
                  <p className="text-sm text-faint">Showing {visible.length} of {ordered.length}</p>
                  {ordered.length > visible.length ? (
                    <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, ordered.length - visible.length)} more</Button>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">{f.q && !member ? "Search covers the free listings until you join." : "Nothing matches those filters yet."}</p>
                <button type="button" onClick={() => setF(EMPTY)} className="mt-3 text-sm font-medium text-oxblood hover:underline">Clear filters</button>
              </div>
            )}
            </div>

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
      <BackToTop />
      <FlierPopup />
    </div>
  );
}
