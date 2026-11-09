import { useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, ArrowUpRight, BookMarked, ChevronDown, Dices, Search, ShoppingBag, SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipButton, CHIP_LABEL, SiteCard } from "@/components/jade-ui";
import { PickDialog } from "@/components/jade-pick-dialog";
import { CornerCarving } from "@/components/corner-carving";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PreviewBar } from "@/components/landing/preview-bar";
import { MODE } from "@/lib/config";
import { MEMBERSHIP_URL, SHOP_URL, SUBSTACK_URL } from "@/lib/site-content";
import {
  ACCESS_LABEL, DATA_URL, DIRECTORY_NAME, DIRECTORY_SHORT, EMPTY, FILTER_FORMATS, FORMAT_LABEL, GENRE_GROUPS, LANGS, MAIN_GENRE_MIN, PROVINCES, REGIONS,
  decode, filtersFromUrl, filtersToUrl, fold, inGenre, matches, regionOf, relevance, suggestHref,
  type Filters, type Lang, type RawData, type Site, type SortKey,
} from "@/lib/directory";
import { cn } from "@/lib/utils";

const PAGE = 24;
const SUGGEST_BODY = "Site name\n\nWeb address\n\nWhat readers will find there\n\nWhere it is based (city, province or country)\n\nFree, paid or both\n";
/* The ATL rose from the featured articles, recoloured in polished jade (public/images/jade-rose.svg). */
function JadeRose({ className }: { className?: string }) {
  return <img src="/images/jade-rose.svg" alt="" aria-hidden="true" width={48} height={42} className={className} />;
}

/* Carved jade sculptures in the side gutters. Decorative only, wide screens only, lazy-loaded, faded. */
const SCULPTURES: { name: string; side: "l" | "r"; top: string; flip?: boolean; h: number }[] = [
  { name: "horse", side: "l", top: "2.5%", flip: true, h: 230 },
  { name: "dragon", side: "r", top: "9%", h: 250 },
  { name: "crane", side: "l", top: "24%", h: 250 },
  { name: "lotus-vase", side: "r", top: "33%", h: 240 },
  { name: "dragon", side: "l", top: "50%", flip: true, h: 240 },
  { name: "horse", side: "r", top: "58%", h: 220 },
  { name: "lotus-vase", side: "l", top: "74%", h: 230 },
  { name: "crane", side: "r", top: "81%", flip: true, h: 240 },
];
function JadeGutters() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 hidden overflow-hidden min-[1400px]:block">
      {SCULPTURES.map((x, i) => (
        <div key={i} className="jade-sculpture absolute flex justify-center" style={{ top: x.top, [x.side === "l" ? "left" : "right"]: 0, width: "calc((100% - 72rem) / 2)" }}>
          <img src={`/images/jade/jade-${x.name}.webp`} alt="" loading="lazy" decoding="async" draggable={false}
            style={{ height: `min(${x.h}px, 17vw)`, transform: x.flip ? "scaleX(-1)" : undefined }} className="w-auto max-w-[85%] object-contain" />
        </div>
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <li aria-hidden="true" className="jade-card rounded-xl bg-cream p-5">
      <div className="animate-pulse space-y-3">
        <div className="flex justify-between"><div className="h-3 w-28 rounded bg-ink/10" /><div className="h-4 w-12 rounded bg-ink/10" /></div>
        <div className="h-5 w-3/4 rounded bg-ink/15" /><div className="h-3 w-1/3 rounded bg-ink/8" />
        <div className="h-3 w-full rounded bg-ink/8" /><div className="h-3 w-5/6 rounded bg-ink/8" />
        <div className="h-9 w-28 rounded bg-ink/8" />
      </div>
    </li>
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
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })}
      className="fixed bottom-5 right-4 z-40 inline-flex size-12 items-center justify-center rounded-full bg-ink text-parchment shadow-xl transition-colors hover:bg-oxblood focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood sm:right-6">
      <ArrowUp className="size-5" />
    </button>
  );
}

export function DirectoryApp() {
  const [data, setData] = useState<{ sites: Site[]; meta: RawData } | null>(null);
  const [failed, setFailed] = useState(false);
  const [f, setF] = useState<Filters>(() => (typeof window === "undefined" ? EMPTY : filtersFromUrl()));
  const [limit, setLimit] = useState(PAGE);
  const [moreOpen, setMoreOpen] = useState(false);
  /* The filter panel starts open on wide screens and folded on phones. It folds itself once, the first time a
     reader scrolls past it, so it never sits over the listings. Opening it again by hand keeps it open. */
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  const autoFolded = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const foldFrom = useRef<number | null>(null);
  const [instant, setInstant] = useState(false);
  const [genresMore, setGenresMore] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const pickBtn = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const q = useDeferredValue(f.q);

  const load = () => {
    setFailed(false);
    fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<RawData>; })
      .then((d) => setData(decode(d))).catch(() => setFailed(true));
  };
  useEffect(load, []);
  useEffect(() => { filtersToUrl(f); }, [f]);
  useEffect(() => { setLimit(PAGE); }, [f.cat, f.acc, f.gen, f.fmt, f.region, f.prov, f.lang, f.subs, f.sort, q]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const sites = data?.sites ?? [];
  const meta = data?.meta;
  const tokens = useMemo(() => fold(q).split(/\s+/).filter(Boolean), [q]);
  const ff = useMemo(() => ({ ...f, q }), [f, q]);
  const formats = meta?.formats ?? [];

  const results = useMemo(() => {
    const list = sites.filter((s) => matches(s, ff, tokens, formats));
    if (ff.sort === "az") return list.sort((a, b) => a.name.localeCompare(b.name, "en-CA"));
    if (ff.sort === "za") return list.sort((a, b) => b.name.localeCompare(a.name, "en-CA"));
    if (tokens.length) return list.sort((a, b) => relevance(b, tokens) - relevance(a, tokens) || b.rank - a.rank || a.name.localeCompare(b.name, "en-CA"));
    return list.sort((a, b) => b.rank - a.rank || a.name.localeCompare(b.name, "en-CA"));
  }, [sites, ff, tokens, formats]);

  /* Counts beside each chip show what you would get by picking it, with your other choices kept. */
  const facets = useMemo(() => {
    const cat = new Array(meta?.categories.length ?? 0).fill(0), acc = [0, 0, 0, 0];
    const region: Record<string, number> = {}, prov: Record<string, number> = {}, gen: Record<string, number> = {};
    let catAll = 0, regionAll = 0;
    for (const s of sites) {
      if (matches(s, ff, tokens, formats, "cat")) { cat[s.cat]++; catAll++; }
      if (matches(s, ff, tokens, formats, "acc")) acc[s.acc]++;
      if (s.gen && matches(s, ff, tokens, formats, "gen")) for (const g of GENRE_GROUPS) if (inGenre(s, g.key)) gen[g.key] = (gen[g.key] ?? 0) + 1;
      if (matches(s, ff, tokens, formats, "region")) {
        regionAll++; const r = regionOf(s.country); region[r] = (region[r] ?? 0) + 1;
        if (s.country === "CA" && s.prov) prov[s.prov] = (prov[s.prov] ?? 0) + 1;
      }
    }
    return { cat, catAll, acc, region, regionAll, prov, gen };
  }, [sites, ff, tokens, formats, meta]);

  const totals = useMemo(() => ({
    all: sites.length,
    free: sites.filter((s) => meta?.access[s.acc] === "free" || meta?.access[s.acc] === "mixed").length,
    canada: sites.filter((s) => s.country === "CA").length,
  }), [sites, meta]);

  const visible = results.slice(0, limit);
  const moreCount = f.fmt.length + (f.lang !== "all" ? 1 : 0) + (f.subs ? 1 : 0) + (f.sort !== "suggested" ? 1 : 0) + (f.prov ? 1 : 0);
  const filtersOn = !!f.q || f.cat >= 0 || f.acc.length > 0 || f.gen.length > 0 || f.region !== "all" || moreCount > 0;
  const activeCount = (f.cat >= 0 ? 1 : 0) + f.acc.length + f.gen.length + (f.region !== "all" ? 1 : 0) + moreCount;
  const genreTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const s of sites) if (s.gen) for (const g of GENRE_GROUPS) if (inGenre(s, g.key)) t[g.key] = (t[g.key] ?? 0) + 1;
    return t;
  }, [sites]);
  const mainGenres = GENRE_GROUPS.filter((g) => (genreTotals[g.key] ?? 0) >= MAIN_GENRE_MIN || f.gen.includes(g.key));
  const moreGenres = GENRE_GROUPS.filter((g) => !mainGenres.includes(g));
  useEffect(() => {
    const onScroll = () => {
      if (autoFolded.current) return;
      const r = document.getElementById("results");
      const panel = panelRef.current;
      if (r && panel && r.getBoundingClientRect().top < 40) {
        autoFolded.current = true;
        foldFrom.current = panel.offsetHeight; setInstant(true); setPanelOpen(false);
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  /* When the panel folds by itself, keep the listings still under the reader's eyes. */
  useLayoutEffect(() => {
    if (foldFrom.current === null || !panelRef.current) return;
    const delta = foldFrom.current - panelRef.current.offsetHeight; foldFrom.current = null;
    if (delta > 0) window.scrollBy(0, -delta);
    requestAnimationFrame(() => setInstant(false));
  }, [panelOpen]);
  const togglePanel = () => { autoFolded.current = true; setPanelOpen((v) => !v); };
  const openPick = (e: React.MouseEvent<HTMLButtonElement>) => { pickBtn.current = e.currentTarget; setPickOpen(true); };
  const selectCls = "mt-1 h-11 w-full rounded-md border border-jade/40 bg-cream px-3 text-base text-ink sm:h-10 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";
  const fmtNum = (n: number) => n.toLocaleString("en-CA");
  const provList = Object.entries(PROVINCES).filter(([k]) => facets.prov[k]).sort((a, b) => (facets.prov[b[0]] ?? 0) - (facets.prov[a[0]] ?? 0));

  return (
    <div id="top" className="jade-focus relative isolate min-h-dvh overflow-x-clip bg-news text-ink">
      <JadeGutters />
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to the listings</a>
      {MODE === "preview" ? <PreviewBar states={["visitor", "free", "member", "founding"]} /> : null}
      <SiteHeader />

      <main>
        <section className="jade-band pb-8 pt-12 md:pb-10 md:pt-16">
          <div className="section-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="kicker kicker-jade">A free reading directory</p>
              <div className="mt-2 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
                <JadeRose className="h-14 w-auto shrink-0 drop-shadow-[0_1px_1px_rgba(23,63,51,0.25)] sm:h-20" />
                <h1 className="jade-script whitespace-nowrap text-[2.9rem] leading-[1.15] min-[400px]:text-[3.3rem] sm:text-[5.2rem] md:text-[6rem]">{DIRECTORY_NAME}</h1>
              </div>
              <div className="jade-rule mt-1 w-28" aria-hidden="true" />
              <p className="text-on-open mt-4 font-display text-2xl font-medium leading-snug tracking-tight text-ink md:text-3xl">Every place worth reading, in one free directory.</p>
              <p className="text-on-open mt-3 max-w-xl text-lead text-muted">Literary magazines, presses, free libraries, bookstores, web fiction, audiobooks and more, from Canada and around the world. Free for everyone, with no sign-up.</p>
              <Button className="jade-polish mt-5 text-parchment hover:brightness-110" onClick={openPick} aria-haspopup="dialog" disabled={!data}><Dices className="size-4" /> Find me a site</Button>
            </div>
            <div className="jade-stat jade-card grid min-w-0 grid-cols-3 divide-x divide-jade/25 rounded-xl bg-cream lg:w-[26rem]">
              {([[totals.all, "reading sites"], [totals.free, "with free reading"], [totals.canada, "Canadian sites"]] as const).map(([n, l]) => (
                <div key={l} className="p-4 text-center">
                  <p className="font-display text-3xl tracking-tight text-jade tabular-nums">{data ? fmtNum(n) : <span className="inline-block h-8 w-14 animate-pulse rounded bg-ink/10 align-middle" />}</p>
                  <p className="mt-1 text-xs leading-snug text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="section-shell">
            <div ref={panelRef} className="jade-card sticky top-16 z-20 -mx-4 border-b border-jade/25 bg-cream/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-cream/90 sm:mx-0 sm:rounded-xl sm:border-b-0 sm:p-4">
                <CornerCarving set="jade" index={3} />
              <div className="flex gap-2">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Search {DIRECTORY_NAME}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-jade" aria-hidden="true" />
                  <input ref={searchRef} id="dir-search" type="search" value={f.q} onChange={(e) => set("q", e.target.value)} enterKeyHint="search" autoComplete="off"
                    placeholder="Search names, places, genres"
                    className="h-11 w-full rounded-md border border-jade/40 bg-paper pl-9 pr-10 text-base text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood sm:text-sm" />
                  <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-jade/35 px-1.5 text-[11px] text-jade sm:block" aria-hidden="true">/</kbd>
                </label>
                <button type="button" aria-expanded={panelOpen} aria-controls="dir-panel" onClick={togglePanel}
                  className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood", panelOpen || activeCount ? "jade-polish text-parchment" : "border border-jade/40 bg-paper text-jade-deep hover:bg-jade/10")}>
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  <span>Filters{activeCount ? <span className="hidden sm:inline"> ({activeCount} active)</span> : null}</span>
                  {activeCount ? <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold leading-5 text-ink sm:hidden" aria-hidden="true">{activeCount}</span> : null}
                  <ChevronDown className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", panelOpen && "rotate-180")} aria-hidden="true" />
                  {activeCount ? <span className="sr-only sm:hidden">, {activeCount} active</span> : null}
                </button>
              </div>
              <div id="dir-panel" className={cn("jade-collapse grid", instant && "transition-none", panelOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")} inert={!panelOpen}>
                <div className="min-h-0 overflow-hidden">
                  <div className="max-h-[62vh] overflow-y-auto overscroll-contain pt-3 md:max-h-none md:overflow-visible">
                    <div className="-mx-4 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Kind of site">
                      <ChipButton on={f.cat < 0} onClick={() => set("cat", -1)} count={data ? facets.catAll : undefined}>Everything</ChipButton>
                      {meta?.categories.map((c, i) => (
                        <ChipButton key={c} on={f.cat === i} onClick={() => set("cat", f.cat === i ? -1 : i)} count={facets.cat[i]} disabled={!facets.cat[i] && f.cat !== i}>{CHIP_LABEL[c] ?? c}</ChipButton>
                      ))}
                    </div>
                    <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Free or paid">
                      {meta?.access.map((a, i) => (
                        <ChipButton key={a} on={f.acc.includes(i)} onClick={() => set("acc", toggleIn(f.acc, i))} count={facets.acc[i]}>{ACCESS_LABEL[a]}</ChipButton>
                      ))}
                      <span className="mx-1 hidden w-px self-stretch bg-jade/25 sm:block" aria-hidden="true" />
                      <ChipButton on={f.region === "CA"} onClick={() => setF((p) => ({ ...p, region: p.region === "CA" ? "all" : "CA", prov: "" }))} count={data ? facets.region.CA ?? 0 : undefined}>
                        <span aria-hidden="true" className="mr-1.5 text-[13px] leading-none">🍁</span>Canadian
                      </ChipButton>
                    </div>
                    <div className="mt-3 border-t border-jade/20 pt-3" role="group" aria-labelledby="genre-h">
                      <p id="genre-h" className="text-xs font-medium text-muted">Genres, where known <span className="text-faint">(any of the ones you pick)</span></p>
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {mainGenres.map((g) => <ChipButton key={g.key} on={f.gen.includes(g.key)} onClick={() => set("gen", toggleIn(f.gen, g.key))} count={data ? facets.gen[g.key] ?? 0 : undefined} disabled={!facets.gen[g.key] && !f.gen.includes(g.key)}>{g.label}</ChipButton>)}
                        {genresMore ? moreGenres.map((g) => <ChipButton key={g.key} on={f.gen.includes(g.key)} onClick={() => set("gen", toggleIn(f.gen, g.key))} count={data ? facets.gen[g.key] ?? 0 : undefined} disabled={!facets.gen[g.key] && !f.gen.includes(g.key)}>{g.label}</ChipButton>) : null}
                        {moreGenres.length ? (
                          <button type="button" aria-expanded={genresMore} onClick={() => setGenresMore((v) => !v)} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-medium text-jade hover:underline">
                            {genresMore ? "Fewer genres" : `More genres (${moreGenres.length})`} <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", genresMore && "rotate-180")} aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-3 border-t border-jade/20 pt-3">
                      <button type="button" aria-expanded={moreOpen} aria-controls="dir-more-filters" onClick={() => setMoreOpen((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-jade hover:underline">
                        {moreOpen ? "Fewer options" : "Region, language, format and sort"}{moreCount ? ` (${moreCount} on)` : ""} <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")} aria-hidden="true" />
                      </button>
                      {moreOpen ? (
                        <div id="dir-more-filters" className="mt-3">
                          <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
                            <label className="text-xs font-medium text-muted">Region
                              <select value={f.region} onChange={(e) => setF((p) => ({ ...p, region: e.target.value as Filters["region"], prov: "" }))} className={selectCls}>
                                {REGIONS.map(([v, l]) => <option key={v} value={v}>{l}{v === "all" ? "" : ` (${fmtNum(facets.region[v] ?? 0)})`}</option>)}
                              </select>
                            </label>
                            {f.region === "CA" ? (
                              <label className="text-xs font-medium text-muted">Province or territory
                                <select value={f.prov} onChange={(e) => set("prov", e.target.value)} className={selectCls}>
                                  <option value="">All of Canada</option>
                                  {provList.map(([k, n]) => <option key={k} value={k}>{n} ({facets.prov[k]})</option>)}
                                </select>
                              </label>
                            ) : null}
                            <label className="text-xs font-medium text-muted">Language
                              <select value={f.lang} onChange={(e) => set("lang", e.target.value as Lang)} className={selectCls}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                            </label>
                            <label className="text-xs font-medium text-muted">Sort
                              <select value={f.sort} onChange={(e) => set("sort", e.target.value as SortKey)} className={selectCls}>
                                <option value="suggested">{f.q ? "Best match" : "Suggested, Canadian first"}</option>
                                <option value="az">Name, A to Z</option>
                                <option value="za">Name, Z to A</option>
                              </select>
                            </label>
                          </div>
                          <fieldset className="mt-3">
                            <legend className="text-xs font-medium text-muted">Formats, where known</legend>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {FILTER_FORMATS.map((x) => <ChipButton key={x} on={f.fmt.includes(x)} onClick={() => set("fmt", toggleIn(f.fmt, x))}>{FORMAT_LABEL[x]}</ChipButton>)}
                              <ChipButton on={f.subs} onClick={() => set("subs", !f.subs)}>Mentions submissions</ChipButton>
                            </div>
                          </fieldset>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div id="results" className="mt-5 flex scroll-mt-48 flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-faint" aria-live="polite">
                {data ? <>{fmtNum(results.length)} {results.length === 1 ? (filtersOn ? "site matches your search" : `site in the ${DIRECTORY_SHORT}`) : (filtersOn ? "sites match your search" : `sites in the ${DIRECTORY_SHORT}`)}</> : failed ? "" : `Loading the ${DIRECTORY_SHORT}`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {filtersOn ? <button type="button" onClick={() => setF(EMPTY)} className="inline-flex items-center gap-1 text-sm font-medium text-jade hover:underline"><X className="size-4" /> Clear filters</button> : null}
                <Button size="sm" className="jade-polish text-parchment hover:brightness-110" onClick={openPick} aria-haspopup="dialog"><Dices className="size-4" /> Find me a site</Button>
              </div>
            </div>

            {failed ? (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">{DIRECTORY_NAME} did not load.</p>
                <p className="mt-2 text-sm text-muted">Check your connection, then try again.</p>
                <Button className="jade-outline-btn mt-4" variant="outline" onClick={load}>Try again</Button>
              </div>
            ) : !data ? (
              <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}</ul>
            ) : results.length ? (
              <>
                <h2 className="sr-only">Reading sites</h2>
                <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((s) => <SiteCard key={s.i} s={s} meta={meta!} />)}</ul>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <p className="text-sm text-jade">Showing {fmtNum(visible.length)} of {fmtNum(results.length)}</p>
                  {results.length > visible.length ? <Button variant="outline" className="jade-outline-btn" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, results.length - visible.length)} more</Button> : null}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">Nothing matches that yet.</p>
                <p className="mt-2 text-sm text-muted">Try fewer filters, or let us pick something for you.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" className="jade-outline-btn" onClick={() => setF(EMPTY)}>Clear filters</Button>
                  <Button className="jade-polish text-parchment hover:brightness-110" onClick={openPick} aria-haspopup="dialog"><Dices className="size-4" /> Find me a site</Button>
                </div>
              </div>
            )}

            <div className="mt-16 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="jade-card jade-top relative rounded-xl bg-cream p-6">
                <CornerCarving set="jade" index={2} />
                <p className="kicker kicker-jade">How it works</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">Gathered with care, checked at the source.</h2>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />Every site comes from public lists, library records and reading communities, then gets one polite visit from our checker. We respect each site's wishes about automated visits.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />Free means you can read there without paying. Paid means the site sells books, issues or subscriptions. Free and paid means a bit of both.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />A small grey dot means access is not yet confirmed, so we could not tell yet. Tap the dot to see this, or hover or tap any other label to see what it is based on.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />{DIRECTORY_NAME} grow as we find more sites. Details change, so check each site before you buy or submit.</li>
                </ul>
                <p className="mt-5 border-t border-jade/20 pt-4 text-sm text-muted">Know a site we are missing? <a href={suggestHref(`${DIRECTORY_SHORT} suggestion`, SUGGEST_BODY)} className="font-medium text-jade underline-offset-4 hover:underline">Email us</a>, especially about Canadian presses, bookshops and little magazines.</p>
              </div>
              <div id="find" className="jade-deep-panel relative flex flex-col rounded-xl p-6 text-parchment shadow-[var(--shadow-border)]">
                <CornerCarving set="jade" index={1} dark />
                <p className="kicker kicker-inverse">Not sure where to start?</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">Let us pick one for you.</h2>
                <p className="mt-3 text-sm leading-relaxed text-parchment/80">Tell us what you are in the mood for, or let chance decide. Every pick is a real site from the list, ready to visit.</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Button className="bg-gold text-ink hover:bg-gold-soft" onClick={openPick} aria-haspopup="dialog"><Dices className="size-4" /> Find me a site</Button>
                </div>
                <p className="mt-3 text-xs text-parchment/60">Spotted a mistake? Use the flag on any listing.</p>
              </div>
            </div>

            <aside className="mt-16" aria-labelledby="more-h">
              <div className="rule-floral rule-floral-jade" aria-hidden="true"><span className="rule-floral-mark"><span /></span></div>
              <p className="kicker kicker-jade mt-8 text-center">From Among The Letters</p>
              <div className="jade-rule mx-auto mt-3 w-20" aria-hidden="true" />
              <h2 id="more-h" className="mt-2 text-center font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">Found something to read? There is more.</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {([
                  [Sparkles, "Afternoon Discoveries", "A free daily newsletter of stories, poems and essays worth your afternoon, with a different genre each day.", SUBSTACK_URL, "Read it free", true],
                  [ShoppingBag, "Guides for writers", "Practical PDF guides to finding the right places for your work and sending it out with confidence.", SHOP_URL, "Visit the shop", false],
                  [BookMarked, "Membership", "The full opportunities database, alerts and the paid newsletter, in one membership.", MEMBERSHIP_URL, "Compare plans", false],
                ] as const).map(([Icon, t, b, href, cta, ext], n) => (
                  <div key={t} className="jade-card jade-top relative flex flex-col rounded-xl bg-cream p-5">
                    <CornerCarving set="jade" index={n + 1} />
                    <span className="flex size-10 items-center justify-center rounded-full bg-jade/12 text-jade"><Icon className="size-5" strokeWidth={1.75} /></span>
                    <h3 className="mt-4 font-display text-xl tracking-tight text-ink">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                    <div className="mt-auto pt-4">
                      <a href={href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})} className="text-sm font-medium text-jade hover:underline">{cta} <ArrowUpRight className="inline size-3.5" /></a>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <PickDialog open={pickOpen} onClose={() => setPickOpen(false)} sites={sites} meta={meta}
        initial={{ cat: f.cat, acc: f.acc, gen: f.gen, fmt: f.fmt, region: f.region, lang: f.lang }} />
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur jade-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <BackToTop />
      <FlierPopup />
    </div>
  );
}
