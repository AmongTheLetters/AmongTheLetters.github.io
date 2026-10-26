import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bell, Bookmark, BookmarkCheck, CalendarPlus, Check, Compass, Lock, LockOpen, Mail, Rss, Search, Sparkles, UserRound, X } from "lucide-react";
import { PRICES, getMembership, getSession, isMember, mockSetState } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { cn } from "@/lib/utils";

/* Preview build. Set to false before launch. */
const PREVIEW = true;

/* ---------- data ---------- */
type OppType = "Contest" | "Call for submissions" | "Grant" | "Residency" | "Fellowship" | "Mentorship" | "Paid market" | "Job";
type Opp = {
  id: string; title: string; org: string; type: OppType; genres: string[]; region: string; location: string; eligibility: string;
  opens?: string; deadline: string | null; deadlineNote?: string; fee: "Free" | "Fee" | "Check"; award: string; summary: string;
  url: string; verified: string; added: string; tier: "free" | "members";
};
type Stub = { id: string; locked: true; type: OppType; region: string; genres: string[]; fee: Opp["fee"]; deadline: string | null; added: string };
type Item = Opp | Stub;
const isStub = (i: Item): i is Stub => "locked" in i;

const TYPES: OppType[] = ["Contest", "Call for submissions", "Grant", "Residency", "Fellowship", "Mentorship", "Paid market", "Job"];
const REGIONS = ["Canada", "United States", "International"];
const WINDOWS = [["any", "Any deadline"], ["7", "Next 7 days"], ["30", "Next 30 days"], ["90", "Next 90 days"], ["rolling", "Rolling or open now"]] as const;
type Win = (typeof WINDOWS)[number][0];
type SortKey = "deadline" | "added" | "name";

/* ---------- dates ---------- */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
const TODAY = iso(new Date());
const daysUntil = (s: string) => Math.round((parse(s).getTime() - parse(TODAY).getTime()) / 86400000);
const fullDate = (s: string) => { const d = parse(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`; };
const monthOnly = (s: string) => { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };

/* ---------- members data ----------
 * Preview: the members list ships encrypted and the mock session opens it with the demo key.
 * Production: supabase.from("opportunities").select("*") returns members-only rows only when
 * row-level security finds an active membership for auth.uid(). Nothing is shipped in the bundle. */
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function decryptMembers(code: string): Promise<Opp[]> {
  const pack = await (await fetch("/opportunities/data/members.enc.json", { cache: "no-store" })).json();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(code.trim().toUpperCase()), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(pack.salt), iterations: pack.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(pack.iv) }, key, unb64(pack.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

/* ---------- calendar export ---------- */
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
function downloadIcs(list: Opp[], name: string) {
  const rows = list.filter((o) => o.deadline).map((o) => {
    const d = o.deadline!.replace(/-/g, "");
    const next = iso(new Date(parse(o.deadline!).getTime() + 86400000)).replace(/-/g, "");
    return ["BEGIN:VEVENT", `UID:atl-opp-${o.id}@amongtheletters.com`, `DTSTAMP:${TODAY.replace(/-/g, "")}T120000Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${icsEsc(`Deadline, ${o.org} ${o.title}`)}`, `DESCRIPTION:${icsEsc(`${o.summary} ${o.deadlineNote ?? ""} ${o.url}`)}`, `URL:${o.url}`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`One week left, ${o.title}`)}`, "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Among The Letters//Opportunities//EN", "CALSCALE:GREGORIAN", ...rows, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/* ---------- local storage ---------- */
const LS = { saved: "atl-opp-saved", search: "atl-opp-search", seen: "atl-opp-last-visit" };
const read = <T,>(k: string, fallback: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

type Filters = { q: string; type: string; region: string; genre: string; win: Win; freeOnly: boolean; savedOnly: boolean; sort: SortKey };
const EMPTY: Filters = { q: "", type: "All", region: "All regions", genre: "All genres", win: "any", freeOnly: false, savedOnly: false, sort: "deadline" };

/* ---------- small pieces ---------- */
function Chip({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "sage" | "gold" }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "sage" ? "bg-sage/12 text-moss" : tone === "gold" ? "bg-gold/15 text-[#6b5326]" : "border border-rule bg-paper text-muted")}>{children}</span>;
}

function Countdown({ o }: { o: { deadline: string | null; opens?: string; deadlineNote?: string } }) {
  if (o.opens && o.opens > TODAY) return <span className="rounded-md bg-sage/12 px-2 py-1 text-xs font-semibold text-moss">Opens {fullDate(o.opens)}</span>;
  if (!o.deadline) return <span className="rounded-md bg-sage/12 px-2 py-1 text-xs font-semibold text-moss">Open now</span>;
  const n = daysUntil(o.deadline);
  const label = n <= 0 ? "Closes today" : n === 1 ? "1 day left" : `${n} days left`;
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", n <= 7 ? "bg-oxblood text-parchment" : n <= 30 ? "bg-gold/20 text-[#6b5326]" : "bg-paper text-muted ring-1 ring-rule")}>{label}</span>;
}

function OppCard({ o, saved, toggleSave, isNew }: { o: Opp; saved: boolean; toggleSave: () => void; isNew: boolean }) {
  return (
    <li className="group flex flex-col rounded-xl bg-cream p-5 shadow-[var(--shadow-border)] transition-shadow hover:shadow-[var(--shadow-border-hover)]">
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
        <button type="button" onClick={toggleSave} aria-pressed={saved} aria-label={saved ? "Remove from saved" : "Save"} className={cn("ml-auto inline-flex size-9 items-center justify-center rounded-md transition-colors", saved ? "bg-oxblood/10 text-oxblood" : "text-faint hover:bg-paper hover:text-ink")}>
          {saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-faint">Checked against the official page {fullDate(o.verified)}</p></div>
    </li>
  );
}

function LockedCard({ s, onUnlock }: { s: Stub; onUnlock: () => void }) {
  return (
    <li className="relative flex flex-col overflow-hidden rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-3"><p className="kicker">{s.type}</p><span className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1 text-xs font-semibold text-parchment"><Lock className="size-3" /> Members</span></div>
      <div aria-hidden="true" className="mt-4 space-y-2 blur-[3px] select-none">
        <div className="h-5 w-4/5 rounded bg-ink/20" /><div className="h-5 w-3/5 rounded bg-ink/20" /><div className="mt-3 h-3.5 w-2/5 rounded bg-ink/12" />
        <div className="h-3 w-full rounded bg-ink/8" /><div className="h-3 w-11/12 rounded bg-ink/8" /><div className="h-3 w-3/4 rounded bg-ink/8" />
      </div>
      <dl className="mt-4 grid gap-1 text-sm text-muted">
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Deadline</dt><dd>{s.deadline ? monthOnly(s.deadline) : "Rolling"}</dd></div>
        <div className="flex gap-2"><dt className="w-20 shrink-0 text-faint">Region</dt><dd>{s.region}</dd></div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-1.5">{s.genres.slice(0, 3).map((g) => <Chip key={g} tone="sage">{g}</Chip>)}{s.fee === "Free" ? <Chip tone="gold">Free to enter</Chip> : null}</div>
      <div className="mt-auto pt-4"><div className="border-t border-rule pt-4">
        <Button size="sm" variant="ink" onClick={onUnlock}><Lock className="size-4" /> Join to unlock</Button>
      </div></div>
    </li>
  );
}

/* ---------- page ---------- */
export function OpportunitiesApp() {
  const [items, setItems] = useState<Item[]>([]);
  const [meta, setMeta] = useState({ built: TODAY, total: 0, free: 0 });
  const [session] = useState(() => getSession());
  const [member] = useState(() => isMember(getMembership()));
  const [f, setF] = useState<Filters>(() => ({ ...EMPTY, ...read<Partial<Filters>>(LS.search, {}), q: "", savedOnly: false }));
  const [saved, setSaved] = useState<string[]>(() => read(LS.saved, []));
  const [lastVisit] = useState<string>(() => read(LS.seen, TODAY));
  const [watching, setWatching] = useState<boolean>(() => !!localStorage.getItem(LS.search));

  useEffect(() => {
    fetch("/opportunities/data/free.json", { cache: "no-store" }).then((r) => r.json()).then((d) => { setItems(d.items); setMeta({ built: d.built, total: d.total, free: d.free }); });
    if (member) decryptMembers("PREVIEW-2026").then(setItems).catch(() => undefined);
    const t = setTimeout(() => write(LS.seen, TODAY), 4000);
    return () => clearTimeout(t);
  }, []);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleSave = (id: string) => setSaved((p) => { const n = p.includes(id) ? p.filter((x) => x !== id) : [...p, id]; write(LS.saved, n); return n; });

  const genres = useMemo(() => Array.from(new Set(items.flatMap((i) => i.genres))).sort(), [items]);
  const typeCounts = useMemo(() => TYPES.map((t) => [t, items.filter((i) => i.type === t).length] as const).filter(([, n]) => n), [items]);

  const filtered = useMemo(() => {
    const needle = f.q.trim().toLowerCase();
    const list = items.filter((i) => {
      if (i.deadline && i.deadline.length === 10 && i.deadline < TODAY) return false;
      if (f.type !== "All" && i.type !== f.type) return false;
      if (f.region !== "All regions" && i.region !== f.region) return false;
      if (f.genre !== "All genres" && !i.genres.includes(f.genre)) return false;
      if (f.freeOnly && i.fee !== "Free") return false;
      if (f.savedOnly && !saved.includes(i.id)) return false;
      if (f.win === "rolling" && i.deadline) return false;
      if (f.win !== "any" && f.win !== "rolling") {
        if (!i.deadline) return false;
        const d = i.deadline.length === 7 ? `${i.deadline}-01` : i.deadline;
        if (daysUntil(d) > Number(f.win)) return false;
      }
      if (needle) {
        if (isStub(i)) return false;
        if (![i.title, i.org, i.location, i.eligibility, i.summary, i.type, ...i.genres].join(" ").toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    const dk = (i: Item) => i.deadline ? (i.deadline.length === 7 ? `${i.deadline}-28` : i.deadline) : "9999";
    return list.sort((a, b) => f.sort === "added" ? b.added.localeCompare(a.added) || dk(a).localeCompare(dk(b))
      : f.sort === "name" ? (isStub(a) ? "~" : a.title).localeCompare(isStub(b) ? "~" : b.title)
      : dk(a).localeCompare(dk(b)) || (isStub(a) ? 1 : 0) - (isStub(b) ? 1 : 0));
  }, [items, f, saved]);

  const open = filtered.filter((i): i is Opp => !isStub(i));
  const lockedCount = filtered.length - open.length;
  const closingSoon = items.filter((i) => i.deadline && i.deadline.length === 10 && daysUntil(i.deadline) >= 0 && daysUntil(i.deadline) <= 14).length;
  const newCount = items.filter((i) => i.added > lastVisit).length;
  const filtersOn = f.q || f.type !== "All" || f.region !== "All regions" || f.genre !== "All genres" || f.win !== "any" || f.freeOnly || f.savedOnly;

  const saveSearch = () => { const { q: _q, savedOnly: _s, ...rest } = f; write(LS.search, rest); setWatching(true); };
  const stopWatching = () => { localStorage.removeItem(LS.search); setWatching(false); };

  const join = () => { window.location.href = session ? "/account/#join" : "/account/?mode=signup&next=join"; };
  const setPreview = (st: "visitor" | "free" | "member" | "canceling") => { mockSetState(st); window.location.reload(); };
  const previewState = !session ? "visitor" : member ? "member" : "free";

  const selectCls = "mt-1 h-10 w-full rounded-md border border-rule bg-cream px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to the opportunities</a>
      {PREVIEW ? (
        <div className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-1.5 text-xs font-medium tracking-wide text-parchment">
          <span>Preview with pretend accounts. View as</span>
          {(["visitor", "free", "member"] as const).map((st) => (
            <button key={st} type="button" onClick={() => setPreview(st)} className={cn("rounded px-2 py-0.5", previewState === st ? "bg-gold text-ink" : "bg-parchment/10 hover:bg-parchment/20")}>{st === "visitor" ? "Visitor" : st === "free" ? "Free account" : "Member"}</button>
          ))}
        </div>
      ) : null}
      <SiteHeader account={session ? { label: "My account", href: "/account/" } : { label: "Sign in", href: "/account/" }} />

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
            {/* membership strip */}
            <div className={cn("flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between", member ? "bg-sage/10 ring-1 ring-sage/25" : "bg-ink text-parchment")}>
              {member ? (
                <>
                  <p className="flex items-center gap-3 text-sm text-ink"><LockOpen className="size-5 shrink-0 text-moss" /> Signed in as {session?.email}. Every listing is open, and your alerts are on.</p>
                  <Button asChild size="sm" variant="outline"><a href="/account/"><UserRound className="size-4" /> My account</a></Button>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Lock className="mt-0.5 size-5 shrink-0 text-gold-soft" />
                    <div><p className="font-display text-xl tracking-tight">{meta.free} listings are free. Members see all {meta.total}.</p>
                      <p className="mt-1 text-sm text-parchment/75">{session ? "You are signed in with a free account. Membership opens everything and includes the paid newsletter." : "Membership opens every listing, adds alerts and includes the paid newsletter on Substack."}</p></div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" className="bg-gold text-ink hover:bg-gold-soft" onClick={join}>Become a member</Button>
                    {session ? null : <Button asChild size="sm" variant="outline"><a href="/account/">Sign in</a></Button>}
                  </div>
                </>
              )}
            </div>

            {/* filters */}
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
                <label className="text-xs font-medium text-muted">Sort<select value={f.sort} onChange={(e) => set("sort", e.target.value as SortKey)} className={selectCls}><option value="deadline">Deadline, soonest first</option><option value="added">Newest added</option><option value="name">Name, A to Z</option></select></label>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" aria-pressed={f.freeOnly} onClick={() => set("freeOnly", !f.freeOnly)} className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", f.freeOnly ? "bg-ink text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}>Free to enter</button>
                <button type="button" aria-pressed={f.savedOnly} onClick={() => set("savedOnly", !f.savedOnly)} className={cn("inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", f.savedOnly ? "bg-ink text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}><Bookmark className="size-3.5" /> Saved {saved.length ? `(${saved.length})` : ""}</button>
                <div className="ml-auto flex flex-wrap items-center gap-3">
                  {filtersOn ? <button type="button" onClick={() => setF((p) => ({ ...EMPTY, sort: p.sort }))} className="inline-flex items-center gap-1 text-sm font-medium text-oxblood hover:underline"><X className="size-4" /> Clear filters</button> : null}
                  {watching ? <span className="inline-flex items-center gap-1.5 text-sm text-moss"><Check className="size-4" /> Search saved on this device <button type="button" onClick={stopWatching} className="text-faint underline hover:text-ink">remove</button></span>
                    : <button type="button" onClick={saveSearch} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-oxblood"><Bell className="size-4" /> Save this search</button>}
                </div>
              </div>
            </div>

            {/* results */}
            <div id="results" className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-faint" aria-live="polite">{open.length} open {open.length === 1 ? "listing" : "listings"}{lockedCount ? ` and ${lockedCount} for members` : ""}{filtersOn ? " match your filters" : ""}</p>
              {open.some((o) => o.deadline) ? <Button size="sm" variant="outline" onClick={() => downloadIcs(open, "atl-opportunities.ics")}><CalendarPlus className="size-4" /> Add these deadlines to my calendar</Button> : null}
            </div>
            {filtered.length ? (
              <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filtered.map((i) => isStub(i) ? <LockedCard key={i.id} s={i} onUnlock={join} />
                  : <OppCard key={i.id} o={i} saved={saved.includes(i.id)} toggleSave={() => toggleSave(i.id)} isNew={i.added > lastVisit} />)}
              </ul>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">{f.q && !member ? "Search covers the free listings until you unlock the rest." : "Nothing matches those filters yet."}</p>
                <button type="button" onClick={() => setF(EMPTY)} className="mt-3 text-sm font-medium text-oxblood hover:underline">Clear filters</button>
              </div>
            )}

            {/* alerts */}
            <div className="mt-16">
              <p className="kicker">Alerts</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">Hear about it before it closes.</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {([
                  [Mail, "The Monday email", "Members get the full paid Morning Opportunities on Substack every Monday, included with membership.", true],
                  [Bell, "Saved search alerts", "Save a search and we email you when a new listing matches it.", true],
                  [CalendarPlus, "Your deadline calendar", "A private calendar link that keeps your saved deadlines in Google, Apple or Outlook, with a reminder a week before.", true],
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
                        : member ? <a href="/account/#alerts" className="text-sm font-medium text-oxblood hover:underline">Manage in your account <ArrowUpRight className="inline size-3.5" /></a>
                        : <button type="button" onClick={join} className="text-sm font-medium text-oxblood hover:underline">Join to turn on <ArrowUpRight className="inline size-3.5" /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* join */}
            {member ? null : (
            <div id="join" className="mt-16 scroll-mt-24">
              <p className="kicker">Membership</p>
              <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">One membership, everything open.</h2>
              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="flex flex-col rounded-xl bg-cream p-6 shadow-[var(--shadow-border)]">
                  <p className="kicker kicker-sage">Free account</p>
                  <p className="mt-3 font-display text-4xl tracking-tight text-ink">$0</p>
                  <ul className="mt-4 space-y-2 text-sm text-muted">{["The listings from the free half of each Monday email", "Filters, bookmarks and one-off calendar reminders", "RSS feed of free listings"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-moss" />{x}</li>)}</ul>
                  <div className="mt-auto pt-6">{session ? <p className="text-sm text-moss">You have a free account.</p> : <Button asChild variant="outline" className="w-full"><a href="/account/?mode=signup">Create a free account</a></Button>}</div>
                </div>
                <div className="relative flex flex-col rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)]">
                  <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-gold px-2.5 py-0.5 text-xs font-semibold text-ink"><Sparkles className="size-3" /> Includes the paid newsletter</span>
                  <p className="kicker kicker-inverse">Member</p>
                  <p className="mt-3 font-display text-4xl tracking-tight">{PRICES.monthly.label}<span className="text-lg text-parchment/70"> {PRICES.monthly.per}</span></p>
                  <p className="text-sm text-parchment/70">or {PRICES.annual.label} {PRICES.annual.per}, two months free</p>
                  <ul className="mt-4 grid gap-2 text-sm text-parchment/85 sm:grid-cols-2">{["Every listing in the database", "Saved search alerts by email", "A private deadline calendar", "A paid Substack subscription to every issue", "Full Monday Morning Opportunities", "Cancel any time from your account"].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-gold-soft" />{x}</li>)}</ul>
                  <div className="mt-auto pt-6"><Button className="w-full bg-gold text-ink hover:bg-gold-soft" onClick={join}>Become a member</Button></div>
                </div>
              </div>
              <p className="mt-4 text-sm text-faint">Prices in Canadian dollars. Details can change after a listing is added, so confirm deadlines, eligibility and fees on each official page before you apply.</p>
            </div>
            )}
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <FlierPopup />
    </div>
  );
}
