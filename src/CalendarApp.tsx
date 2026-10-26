import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, Download, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { FEATURED, downloadName } from "@/components/landing/featured";
import { FEATURED_SCHEDULE, type ScheduledFeature } from "@/lib/featured-schedule";
import { AUDIENCES, EVENTS, REGIONS, type LitEvent } from "@/lib/events";
import { cn } from "@/lib/utils";

/* ---------- dates ---------- */
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const monthKey = (y: number, m: number) => y * 12 + m;
const longDate = (s: string) => { const d = parse(s); return `${WEEKDAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const shortDate = (s: string) => { const d = parse(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`; };
function dateRange(a: string, b: string) {
  if (a === b) return `${shortDate(a)}, ${parse(a).getFullYear()}`;
  const A = parse(a), B = parse(b);
  if (A.getFullYear() !== B.getFullYear()) return `${shortDate(a)}, ${A.getFullYear()} to ${shortDate(b)}, ${B.getFullYear()}`;
  if (A.getMonth() === B.getMonth()) return `${shortDate(a)} to ${B.getDate()}, ${B.getFullYear()}`;
  return `${shortDate(a)} to ${shortDate(b)}, ${B.getFullYear()}`;
}
const TODAY = iso(new Date());
const FIRST = { y: 2026, m: 9 };   // October 2026
const LAST = { y: 2027, m: 11 };   // December 2027

/* ---------- calendar entries ---------- */
type Entry =
  | { kind: "featured"; date: string; label: string; item: ScheduledFeature }
  | { kind: "event"; date: string; label: string; item: LitEvent };

function featuredLabel(f: ScheduledFeature) {
  if (f.list) return "Year in reading list";
  if (/feature$/i.test(f.occasion)) return "Seasonal featured piece";
  return `${f.occasion} featured piece`;
}

const ENTRIES: Entry[] = (() => {
  const out: Entry[] = FEATURED_SCHEDULE.map((f) => ({ kind: "featured" as const, date: f.live, label: featuredLabel(f), item: f }));
  for (const e of EVENTS) for (let d = e.start; d <= e.end; d = addDays(d, 1)) out.push({ kind: "event", date: d, label: e.name, item: e });
  return out;
})();
const BY_DATE = ENTRIES.reduce<Record<string, Entry[]>>((acc, e) => { (acc[e.date] ||= []).push(e); return acc; }, {});
Object.values(BY_DATE).forEach((list) => list.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "featured" ? -1 : 1)));

function monthGrid(y: number, m: number) {
  const first = new Date(y, m, 1);
  const start = new Date(y, m, 1 - first.getDay());
  const days: string[] = [];
  const weeks = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7);
  for (let i = 0; i < weeks * 7; i++) days.push(iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)));
  return days;
}

/* ---------- small pieces ---------- */
function Dot({ kind, className }: { kind: Entry["kind"]; className?: string }) {
  return <span aria-hidden="true" className={cn("inline-block size-2 shrink-0 rounded-full", kind === "featured" ? "bg-gold" : "bg-sage", className)} />;
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-rule bg-paper px-2.5 py-0.5 text-xs font-medium text-muted">{children}</span>;
}

function EntryDetail({ entry }: { entry: Entry }) {
  if (entry.kind === "featured") {
    const isCurrent = entry.item.live <= TODAY && !FEATURED_SCHEDULE.some((f) => f.live > entry.item.live && f.live <= TODAY);
    return (
      <div className="rounded-lg border border-gold-soft/60 bg-cream p-4">
        <div className="flex items-center gap-2"><Dot kind="featured" /><p className="kicker">Featured piece</p></div>
        <p className="mt-2 font-display text-xl tracking-tight text-ink">{entry.label}</p>
        <p className="mt-1 text-sm text-muted">
          {entry.item.list
            ? "A larger list feature looking back on the year's best reading, free on the website."
            : "A new free piece from Among The Letters goes live on the website today."}
        </p>
        {isCurrent ? (
          <a href={FEATURED.pdf} target="_blank" rel="noopener" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-oxblood underline-offset-4 hover:underline">
            Read the current piece <ArrowUpRight className="size-4" />
          </a>
        ) : null}
      </div>
    );
  }
  const e = entry.item;
  const place = [e.city, e.province, e.country].filter(Boolean).join(", ");
  return (
    <div className="rounded-lg border border-sage/30 bg-cream p-4">
      <div className="flex items-center gap-2"><Dot kind="event" /><p className="kicker kicker-sage">{e.type}</p></div>
      <p className="mt-2 font-display text-xl leading-snug tracking-tight text-ink">{e.name}</p>
      <p className="mt-1 text-sm text-muted">{dateRange(e.start, e.end)}</p>
      <p className="mt-1 flex items-start gap-1.5 text-sm text-muted"><MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />{place}</p>
      <div className="mt-3 flex flex-wrap gap-1.5"><Chip>{e.audience}</Chip><Chip>{e.cost}</Chip><Chip>{e.format}</Chip></div>
      {e.note ? <p className="mt-3 text-sm leading-relaxed text-muted">{e.note}.</p> : null}
      <a href={e.url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-oxblood underline-offset-4 hover:underline">
        Official site <ArrowUpRight className="size-4" />
      </a>
    </div>
  );
}

/* ---------- page ---------- */
type Tab = "calendar" | "events";
type SortKey = "soonest" | "latest" | "name";

export function CalendarApp() {
  const [tab, setTab] = useState<Tab>(() => (typeof window !== "undefined" && window.location.hash === "#events" ? "events" : "calendar"));
  const startMonth = (() => { const d = parse(TODAY); const k = Math.min(Math.max(monthKey(d.getFullYear(), d.getMonth()), monthKey(FIRST.y, FIRST.m)), monthKey(LAST.y, LAST.m)); return { y: Math.floor(k / 12), m: k % 12 }; })();
  const [view, setView] = useState(startMonth);
  const [selected, setSelected] = useState<string>(() => {
    const d = parse(TODAY);
    return d.getFullYear() === startMonth.y && d.getMonth() === startMonth.m ? TODAY : iso(new Date(startMonth.y, startMonth.m, 1));
  });
  const gridRef = useRef<HTMLDivElement>(null);
  const focusPending = useRef(false);

  useEffect(() => {
    const onHash = () => setTab(window.location.hash === "#events" ? "events" : "calendar");
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const chooseTab = (t: Tab) => { setTab(t); history.replaceState(null, "", t === "events" ? "#events" : "#calendar"); };

  const k = monthKey(view.y, view.m);
  const canPrev = k > monthKey(FIRST.y, FIRST.m);
  const canNext = k < monthKey(LAST.y, LAST.m);
  const days = useMemo(() => monthGrid(view.y, view.m), [view]);

  const goMonth = useCallback((delta: number) => {
    const nk = Math.min(Math.max(monthKey(view.y, view.m) + delta, monthKey(FIRST.y, FIRST.m)), monthKey(LAST.y, LAST.m));
    const y = Math.floor(nk / 12), m = nk % 12;
    setView({ y, m });
    setSelected(iso(new Date(y, m, 1)));
  }, [view]);

  const selectDate = useCallback((d: string, focus = false) => {
    const dd = parse(d);
    const nk = monthKey(dd.getFullYear(), dd.getMonth());
    if (nk < monthKey(FIRST.y, FIRST.m) || nk > monthKey(LAST.y, LAST.m)) return;
    setView({ y: dd.getFullYear(), m: dd.getMonth() });
    setSelected(d);
    focusPending.current = focus;
  }, []);

  useEffect(() => {
    if (!focusPending.current) return;
    focusPending.current = false;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${selected}"]`)?.focus();
  }, [selected, view]);

  const onGridKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in moves) { e.preventDefault(); selectDate(addDays(selected, moves[e.key]), true); return; }
    const d = parse(selected);
    if (e.key === "Home") { e.preventDefault(); selectDate(addDays(selected, -d.getDay()), true); }
    if (e.key === "End") { e.preventDefault(); selectDate(addDays(selected, 6 - d.getDay()), true); }
    if (e.key === "PageUp" || e.key === "PageDown") {
      e.preventDefault();
      const t = new Date(d.getFullYear(), d.getMonth() + (e.key === "PageUp" ? -1 : 1), 1);
      const day = Math.min(d.getDate(), new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate());
      selectDate(iso(new Date(t.getFullYear(), t.getMonth(), day)), true);
    }
  };

  const selectedEntries = BY_DATE[selected] ?? [];
  const monthEntries = useMemo(() => {
    const seen = new Set<string>();
    return ENTRIES.filter((e) => { const d = parse(e.date); return d.getFullYear() === view.y && d.getMonth() === view.m; })
      .sort((a, b) => a.date.localeCompare(b.date))
      .filter((e) => { const key = e.kind === "event" ? e.item.id : e.date; if (seen.has(key)) return false; seen.add(key); return true; });
  }, [view]);

  /* ----- events filters ----- */
  const [q, setQ] = useState("");
  const [type, setType] = useState("All types");
  const [region, setRegion] = useState("All regions");
  const [month, setMonth] = useState("Any month");
  const [audience, setAudience] = useState("Everyone");
  const [freeOnly, setFreeOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("soonest");
  const upcoming = useMemo(() => EVENTS.filter((e) => e.end >= TODAY), []);
  const typeOptions = useMemo(() => Array.from(new Set(upcoming.map((e) => e.type))), [upcoming]);
  const monthOptions = useMemo(() => {
    const keys = new Set<string>();
    upcoming.forEach((e) => { for (let d = e.start; d <= e.end; d = addDays(d, 1)) keys.add(d.slice(0, 7)); });
    return Array.from(keys).sort();
  }, [upcoming]);
  const monthName = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = upcoming.filter((e) =>
      (!needle || [e.name, e.city, e.province, e.country, e.type].join(" ").toLowerCase().includes(needle)) &&
      (type === "All types" || e.type === type) &&
      (region === "All regions" || e.region === region) &&
      (month === "Any month" || (e.start.slice(0, 7) <= month && e.end.slice(0, 7) >= month)) &&
      (audience === "Everyone" || e.audience === audience || e.audience === "Readers and writers") &&
      (!freeOnly || e.cost !== "Paid") &&
      (!onlineOnly || e.format !== "In person"));
    return list.sort((a, b) => sort === "name" ? a.name.localeCompare(b.name) : sort === "latest" ? b.start.localeCompare(a.start) : a.start.localeCompare(b.start));
  }, [upcoming, q, type, region, month, audience, freeOnly, onlineOnly, sort]);
  const filtersOn = q || type !== "All types" || region !== "All regions" || month !== "Any month" || audience !== "Everyone" || freeOnly || onlineOnly;
  const clearFilters = () => { setQ(""); setType("All types"); setRegion("All regions"); setMonth("Any month"); setAudience("Everyone"); setFreeOnly(false); setOnlineOnly(false); };
  const showOnCalendar = (e: LitEvent) => { chooseTab("calendar"); selectDate(e.start < TODAY ? TODAY : e.start); window.scrollTo({ top: 0, behavior: "smooth" }); };

  const selectCls = "h-10 w-full rounded-md border border-rule bg-cream px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#calendar-panel" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to the calendar</a>
      <SiteHeader />

      <main>
        <section className="pb-8 pt-12 md:pb-10 md:pt-16">
          <div className="section-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 text-oxblood">
                <CalendarDays className="size-5" strokeWidth={1.75} />
                <p className="kicker">The calendar</p>
              </div>
              <h1 className="text-on-open mt-4 font-display text-5xl font-medium tracking-tight text-ink md:text-6xl">A year of reading, day by day.</h1>
              <p className="text-on-open mt-4 max-w-xl text-lead text-muted">New featured pieces and book fairs, festivals and conferences for readers and writers, all in one place.</p>
            </div>
            <div className="flex flex-col gap-3 rounded-xl border border-bark/25 bg-cream p-5 shadow-[var(--shadow-border)] sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-medium text-muted">Featured now · {FEATURED.date}</p>
                <p className="mt-1 font-display text-xl tracking-tight text-ink">{FEATURED.title}</p>
              </div>
              <div className="flex gap-2 sm:ml-4">
                <Button asChild size="sm"><a href={FEATURED.pdf} target="_blank" rel="noopener">Read <ArrowUpRight className="size-4" /></a></Button>
                <Button asChild size="sm" variant="outline"><a href={FEATURED.pdf} download={downloadName(FEATURED)}>PDF <Download className="size-4" /></a></Button>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="section-shell">
            <div role="tablist" aria-label="Calendar views" className="flex gap-1 border-b border-rule">
              {([["calendar", "Calendar"], ["events", `Events (${upcoming.length})`]] as const).map(([id, label]) => (
                <button key={id} role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`${id}-panel`} type="button" onClick={() => chooseTab(id)}
                  className={cn("-mb-px border-b-2 px-4 py-3 text-sm font-medium transition-colors", tab === id ? "border-oxblood text-ink" : "border-transparent text-muted hover:text-ink")}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "calendar" ? (
              <div id="calendar-panel" role="tabpanel" aria-labelledby="tab-calendar" className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <div className="min-w-0 rounded-xl bg-cream p-3 shadow-[var(--shadow-border)] sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-4">
                    <h2 className="font-display text-3xl font-medium tracking-tight text-ink" aria-live="polite">{MONTHS[view.m]} <span className="text-faint">{view.y}</span></h2>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => selectDate(TODAY)} disabled={TODAY < iso(new Date(FIRST.y, FIRST.m, 1))}>Today</Button>
                      <Button size="icon" variant="outline" className="size-9" onClick={() => goMonth(-1)} disabled={!canPrev} aria-label="Previous month"><ChevronLeft className="size-4" /></Button>
                      <Button size="icon" variant="outline" className="size-9" onClick={() => goMonth(1)} disabled={!canNext} aria-label="Next month"><ChevronRight className="size-4" /></Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-7 border-b border-rule pb-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-faint" aria-hidden="true">
                    {WEEKDAYS.map((w) => <div key={w}><span className="sm:hidden">{w[0]}</span><span className="hidden sm:inline">{w.slice(0, 3)}</span></div>)}
                  </div>
                  <div ref={gridRef} role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`} onKeyDown={onGridKey} className="grid grid-cols-7">
                    {days.map((d) => {
                      const dd = parse(d);
                      const inMonth = dd.getMonth() === view.m;
                      const items = BY_DATE[d] ?? [];
                      const isSel = d === selected, isToday = d === TODAY;
                      return (
                        <button key={d} type="button" role="gridcell" data-date={d} tabIndex={isSel ? 0 : -1} aria-selected={isSel}
                          aria-label={`${longDate(d)}${items.length ? `, ${items.map((i) => i.label).join(", ")}` : ", nothing scheduled"}`}
                          onClick={() => selectDate(d)}
                          className={cn("group relative flex h-14 flex-col items-center gap-1 border-b border-r border-rule/70 p-1 text-left transition-colors sm:h-28 sm:items-stretch sm:p-2 [&:nth-child(7n)]:border-r-0",
                            inMonth ? "bg-cream" : "bg-paper/60 text-faint", isSel ? "bg-paper ring-2 ring-inset ring-oxblood" : "hover:bg-paper",
                            "focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-oxblood")}>
                          <span className={cn("flex size-7 items-center justify-center rounded-full text-sm", isToday ? "bg-oxblood font-semibold text-parchment" : inMonth ? "text-ink" : "text-faint")}>{dd.getDate()}</span>
                          <span className="flex gap-1 sm:hidden">{items.slice(0, 3).map((i, n) => <Dot key={n} kind={i.kind} className="size-1.5" />)}</span>
                          <span className="hidden w-full flex-col gap-1 sm:flex">
                            {items.slice(0, 2).map((i, n) => (
                              <span key={n} className={cn("truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight",
                                i.kind === "featured" ? "bg-gold/15 text-[#6b5326]" : "bg-sage/12 text-moss")}>{i.label}</span>
                            ))}
                            {items.length > 2 ? <span className="px-1.5 text-[11px] text-faint">+{items.length - 2} more</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 pt-4 text-sm text-muted">
                    <span className="inline-flex items-center gap-2"><Dot kind="featured" /> Featured pieces</span>
                    <span className="inline-flex items-center gap-2"><Dot kind="event" /> Book fairs and events</span>
                    <span className="hidden text-faint md:inline">Arrow keys move between days</span>
                  </div>
                </div>

                <aside aria-live="polite" className="flex min-w-0 flex-col gap-4">
                  <div className="rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
                    <p className="kicker">Selected day</p>
                    <h3 className="mt-2 font-display text-2xl tracking-tight text-ink">{longDate(selected)}</h3>
                    <div className="mt-4 flex flex-col gap-3">
                      {selectedEntries.length ? selectedEntries.map((e, n) => <EntryDetail key={n} entry={e} />)
                        : <p className="text-sm text-muted">Nothing is planned for this day yet. Pick a marked day to see what is on.</p>}
                    </div>
                  </div>
                  {monthEntries.length ? (
                    <div className="rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
                      <p className="kicker">This month</p>
                      <ul className="mt-3 divide-y divide-rule">
                        {monthEntries.map((e, n) => (
                          <li key={n}>
                            <button type="button" onClick={() => selectDate(e.kind === "event" && e.item.start >= iso(new Date(view.y, view.m, 1)) ? e.item.start : e.date)}
                              className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:text-oxblood focus-visible:outline-2 focus-visible:outline-oxblood">
                              <Dot kind={e.kind} />
                              <span className="w-14 shrink-0 text-faint">{shortDate(e.kind === "event" && e.item.start >= iso(new Date(view.y, view.m, 1)) ? e.item.start : e.date)}</span>
                              <span className="min-w-0 truncate text-ink">{e.label}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </aside>
              </div>
            ) : (
              <div id="events-panel" role="tabpanel" aria-labelledby="tab-events" className="mt-6">
                <div className="rounded-xl bg-cream p-4 shadow-[var(--shadow-border)] sm:p-5">
                  <label className="relative block">
                    <span className="sr-only">Search events</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
                    <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, city or country" className={cn(selectCls, "h-11 pl-9")} />
                  </label>
                  <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-5">
                    <label className="text-xs font-medium text-muted">Type<select value={type} onChange={(e) => setType(e.target.value)} className={cn(selectCls, "mt-1")}><option>All types</option>{typeOptions.map((t) => <option key={t}>{t}</option>)}</select></label>
                    <label className="text-xs font-medium text-muted">Region<select value={region} onChange={(e) => setRegion(e.target.value)} className={cn(selectCls, "mt-1")}><option>All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
                    <label className="text-xs font-medium text-muted">Month<select value={month} onChange={(e) => setMonth(e.target.value)} className={cn(selectCls, "mt-1")}><option>Any month</option>{monthOptions.map((m) => <option key={m} value={m}>{monthName(m)}</option>)}</select></label>
                    <label className="text-xs font-medium text-muted">For<select value={audience} onChange={(e) => setAudience(e.target.value)} className={cn(selectCls, "mt-1")}><option>Everyone</option>{AUDIENCES.filter((a) => a !== "Readers and writers").map((a) => <option key={a}>{a}</option>)}</select></label>
                    <label className="col-span-2 text-xs font-medium text-muted md:col-span-1">Sort<select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={cn(selectCls, "mt-1")}><option value="soonest">Soonest first</option><option value="latest">Latest first</option><option value="name">Name, A to Z</option></select></label>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {([["Free entry", freeOnly, setFreeOnly], ["Online options", onlineOnly, setOnlineOnly]] as const).map(([label, on, set]) => (
                      <button key={label} type="button" aria-pressed={on} onClick={() => set(!on)}
                        className={cn("rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors", on ? "bg-ink text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}>{label}</button>
                    ))}
                    {filtersOn ? <button type="button" onClick={clearFilters} className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-oxblood hover:underline"><X className="size-4" /> Clear filters</button> : null}
                  </div>
                </div>

                <p className="mt-5 text-sm text-faint" aria-live="polite">{filtered.length} {filtered.length === 1 ? "event" : "events"}{filtersOn ? " match your filters" : " coming up"}</p>
                {filtered.length ? (
                  <ul className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filtered.map((e) => (
                      <li key={e.id} className="flex flex-col rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
                        <div className="flex items-center justify-between gap-3"><p className="kicker kicker-sage">{e.type}</p><span className="text-xs text-faint">{e.region}</span></div>
                        <h3 className="mt-3 font-display text-2xl leading-tight tracking-tight text-ink">{e.name}</h3>
                        <p className="mt-2 text-sm font-medium text-ink">{dateRange(e.start, e.end)}</p>
                        <p className="mt-1 flex items-start gap-1.5 text-sm text-muted"><MapPin className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />{[e.city, e.province, e.country].filter(Boolean).join(", ")}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5"><Chip>{e.audience}</Chip><Chip>{e.cost}</Chip><Chip>{e.format}</Chip></div>
                        {e.note ? <p className="mt-3 text-sm leading-relaxed text-muted">{e.note}.</p> : null}
                        <div className="mt-auto pt-4"><div className="flex flex-wrap gap-2 border-t border-rule pt-4">
                          <Button asChild size="sm"><a href={e.url} target="_blank" rel="noopener noreferrer">Official site <ArrowUpRight className="size-4" /></a></Button>
                          <Button size="sm" variant="outline" onClick={() => showOnCalendar(e)}><CalendarDays className="size-4" /> On the calendar</Button>
                        </div></div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                    <p className="font-display text-xl text-ink">No events match those filters.</p>
                    <button type="button" onClick={clearFilters} className="mt-3 text-sm font-medium text-oxblood hover:underline">Clear filters</button>
                  </div>
                )}
                <p className="mt-8 max-w-2xl text-sm text-faint">Dates come from each organiser's official site. More events are added as organisers publish their dates, so check the official site before you travel.</p>
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
