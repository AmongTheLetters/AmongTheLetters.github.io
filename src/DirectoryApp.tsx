import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp, ArrowUpRight, Award, BookMarked, BookOpen, Feather, Flag, Globe, Headphones, LibraryBig, Mail, MapPin, MessagesSquare,
  Newspaper, PenLine, Search, Send, ShoppingBag, SlidersHorizontal, Sparkles, Store, TabletSmartphone, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { PreviewBar } from "@/components/landing/preview-bar";
import { MODE } from "@/lib/config";
import { MEMBERSHIP_URL, SHOP_URL, SUBSTACK_URL } from "@/lib/site-content";
import {
  ACCESS_HINT, ACCESS_LABEL, DATA_URL, DIRECTORY_NAME, DIRECTORY_SHORT, EMPTY, FILTER_FORMATS, FORMAT_LABEL, LANGS, PROVINCES, REGIONS, decode, filtersFromUrl,
  filtersToUrl, fold, languageName, matches, placeLabel, regionOf, relevance, suggestHref,
  type Filters, type Lang, type RawData, type Site, type SortKey,
} from "@/lib/directory";
import { cn } from "@/lib/utils";

const PAGE = 24;
const CAT_ICON = [BookMarked, Newspaper, LibraryBig, Store, Award, Feather, PenLine, Headphones, TabletSmartphone, Mail, MessagesSquare];
/* Shorter names for the filter chips, so the bar stays compact. Cards keep the full category name. */
const CHIP_LABEL: Record<string, string> = {
  "Publishers & Presses": "Publishers", "Literary Magazines & Journals": "Magazines & Journals", "Free Reading Libraries & Archives": "Libraries & Archives",
  "Literary Awards & Organizations": "Awards & Organizations", "Web Fiction, Serials & Webcomics": "Web Fiction & Comics",
  "Ebook Stores & Platforms": "Ebooks", "Book Reviews & Communities": "Reviews & Communities",
};
const SUGGEST_BODY = "Site name\n\nWeb address\n\nWhat readers will find there\n\nWhere it is based (city, province or country)\n\nFree, paid or both\n";

function ChipButton({ on, onClick, children, count, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      className={cn("inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood disabled:opacity-45",
        on ? "jade-polish text-parchment" : "border border-rule bg-paper text-muted hover:text-ink")}>
      {children}{count !== undefined ? <span className={cn("ml-1.5 text-xs tabular-nums", on ? "text-parchment/75" : "text-faint")}>{count.toLocaleString("en-CA")}</span> : null}
    </button>
  );
}

function AccessBadge({ access, evidence }: { access: string; evidence: string }) {
  const tone = access === "free" ? "bg-sage/15 text-moss" : access === "paid" ? "bg-ink text-parchment" : access === "mixed" ? "bg-gold/20 text-[#5c4620]" : "border border-dashed border-rule-strong text-muted";
  const title = ACCESS_HINT[access] + (evidence ? `. Based on ${evidence}.` : ".");
  return <span title={title} className={cn("inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-[11px] font-semibold", tone)}>{ACCESS_LABEL[access]}<span className="sr-only">. {title}</span></span>;
}

function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "sage" | "gold" }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "sage" ? "bg-sage/12 text-moss" : tone === "gold" ? "bg-gold/15 text-[#5c4620]" : "border border-rule bg-paper text-muted")}>{children}</span>;
}

function SiteCard({ s, meta }: { s: Site; meta: RawData }) {
  const access = meta.access[s.acc];
  const formats = meta.formats.filter((_, b) => (s.fmt >> b) & 1);
  const genres = meta.genres.filter((_, b) => (s.gen >> b) & 1).slice(0, 2);
  const place = placeLabel(s);
  const CatIcon = CAT_ICON[s.cat] ?? BookOpen;
  return (
    <li className="group flex flex-col rounded-xl bg-cream p-5 shadow-[var(--shadow-border)] transition-[box-shadow] duration-300 hover:shadow-[var(--shadow-border-hover)]">
      <div className="flex items-start justify-between gap-3">
        <p className="kicker kicker-jade flex items-center gap-1.5"><CatIcon className="size-3.5" strokeWidth={1.75} aria-hidden="true" />{meta.categories[s.cat]}</p>
        <AccessBadge access={access} evidence={s.evidence} />
      </div>
      <h3 className="mt-2.5 font-display text-xl leading-snug tracking-tight text-ink">
        <a href={s.url} target="_blank" rel="noopener nofollow ugc" className="rounded-sm decoration-oxblood/40 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood">
          {s.name}<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        <span className="inline-flex min-w-0 items-center gap-1"><Globe className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{s.domain.replace(/^www\./, "")}</span></span>
        {place ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{place}</span> : null}
      </p>
      {s.desc ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{s.desc}</p> : <p className="mt-3 text-sm italic text-faint">No description yet.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {formats.map((f) => <Tag key={f}>{FORMAT_LABEL[f]}</Tag>)}
        {genres.map((g) => <Tag key={g} tone="sage">{g[0].toUpperCase() + g.slice(1)}</Tag>)}
        {s.subs ? <Tag tone="gold">Mentions submissions</Tag> : null}
        {s.lang && s.lang !== "en" ? <Tag>In {languageName(s.lang)}</Tag> : null}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        <Button asChild size="sm" variant="outline">
          <a href={s.url} target="_blank" rel="noopener nofollow ugc" aria-label={`Visit ${s.name} (opens in a new tab)`}>Visit site <ArrowUpRight className="size-4" /></a>
        </Button>
        <a href={suggestHref(`${DIRECTORY_SHORT} fix for ${s.domain}`, `Listing ${s.name} (${s.url})\n\nWhat needs fixing\n`)}
          className="inline-flex size-9 items-center justify-center rounded-md text-faint transition-colors hover:bg-paper hover:text-oxblood focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
          title="Suggest a correction" aria-label={`Suggest a correction for ${s.name}`}><Flag className="size-4" /></a>
      </div>
    </li>
  );
}

/* The ATL rose from the featured articles, recoloured in polished jade (public/images/jade-rose.svg). */
function JadeRose({ className }: { className?: string }) {
  return <img src="/images/jade-rose.svg" alt="" aria-hidden="true" width={48} height={42} className={className} />;
}

function SkeletonCard() {
  return (
    <li aria-hidden="true" className="rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
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
  const searchRef = useRef<HTMLInputElement>(null);
  const q = useDeferredValue(f.q);

  const load = () => {
    setFailed(false);
    fetch(DATA_URL).then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<RawData>; })
      .then((d) => setData(decode(d))).catch(() => setFailed(true));
  };
  useEffect(load, []);
  useEffect(() => { filtersToUrl(f); }, [f]);
  useEffect(() => { setLimit(PAGE); }, [f.cat, f.acc, f.fmt, f.region, f.prov, f.lang, f.subs, f.sort, q]);
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
    const region: Record<string, number> = {}, prov: Record<string, number> = {};
    let catAll = 0, regionAll = 0;
    for (const s of sites) {
      if (matches(s, ff, tokens, formats, "cat")) { cat[s.cat]++; catAll++; }
      if (matches(s, ff, tokens, formats, "acc")) acc[s.acc]++;
      if (matches(s, ff, tokens, formats, "region")) {
        regionAll++; const r = regionOf(s.country); region[r] = (region[r] ?? 0) + 1;
        if (s.country === "CA" && s.prov) prov[s.prov] = (prov[s.prov] ?? 0) + 1;
      }
    }
    return { cat, catAll, acc, region, regionAll, prov };
  }, [sites, ff, tokens, formats, meta]);

  const totals = useMemo(() => ({
    all: sites.length,
    free: sites.filter((s) => meta?.access[s.acc] === "free" || meta?.access[s.acc] === "mixed").length,
    canada: sites.filter((s) => s.country === "CA").length,
  }), [sites, meta]);

  const visible = results.slice(0, limit);
  const moreCount = f.fmt.length + (f.lang !== "all" ? 1 : 0) + (f.subs ? 1 : 0) + (f.sort !== "suggested" ? 1 : 0) + (f.prov ? 1 : 0);
  const filtersOn = !!f.q || f.cat >= 0 || f.acc.length > 0 || f.region !== "all" || moreCount > 0;
  const selectCls = "mt-1 h-11 w-full rounded-md border border-rule bg-cream px-3 text-base text-ink sm:h-10 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";
  const fmtNum = (n: number) => n.toLocaleString("en-CA");
  const provList = Object.entries(PROVINCES).filter(([k]) => facets.prov[k]).sort((a, b) => (facets.prov[b[0]] ?? 0) - (facets.prov[a[0]] ?? 0));

  return (
    <div id="top" className="jade-focus relative isolate min-h-dvh bg-news text-ink">
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to the listings</a>
      {MODE === "preview" ? <PreviewBar states={["visitor", "free", "member", "founding"]} /> : null}
      <SiteHeader />

      <main>
        <section className="jade-band pb-8 pt-12 md:pb-10 md:pt-16">
          <div className="section-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3"><JadeRose className="h-14 w-auto drop-shadow-[0_1px_1px_rgba(23,63,51,0.25)]" /><p className="kicker kicker-jade">{DIRECTORY_NAME}</p></div>
              <div className="jade-rule mt-4 w-24" aria-hidden="true" />
              <h1 className="text-on-open mt-4 font-display text-5xl font-medium tracking-tight text-ink md:text-6xl">Every place worth reading, in one free directory.</h1>
              <p className="text-on-open mt-4 max-w-xl text-lead text-muted">Literary magazines, presses, free libraries, bookstores, web fiction, audiobooks and more, from Canada and around the world. Free for everyone, with no sign-up.</p>
            </div>
            <div className="jade-stat grid min-w-0 grid-cols-3 divide-x divide-rule rounded-xl bg-cream shadow-[var(--shadow-border)] lg:w-[26rem]">
              {([[totals.all, "reading sites"], [totals.free, "with free reading"], [totals.canada, "Canadian sites"]] as const).map(([n, l]) => (
                <div key={l} className="p-4 text-center">
                  <p className="font-display text-3xl tracking-tight text-ink tabular-nums">{data ? fmtNum(n) : <span className="inline-block h-8 w-14 animate-pulse rounded bg-ink/10 align-middle" />}</p>
                  <p className="mt-1 text-xs leading-snug text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="section-shell">
            <div className="sticky top-16 z-20 -mx-4 border-b border-rule bg-cream/95 px-4 py-3 shadow-[var(--shadow-border)] backdrop-blur supports-[backdrop-filter]:bg-cream/90 sm:mx-0 sm:rounded-xl sm:border-b-0 sm:p-4">
              <div className="flex gap-2">
                <label className="relative block min-w-0 flex-1">
                  <span className="sr-only">Search {DIRECTORY_NAME}</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
                  <input ref={searchRef} id="dir-search" type="search" value={f.q} onChange={(e) => set("q", e.target.value)} enterKeyHint="search" autoComplete="off"
                    placeholder="Search names, places, genres"
                    className="h-11 w-full rounded-md border border-rule bg-paper pl-9 pr-10 text-base text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood sm:text-sm" />
                  <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-rule px-1.5 text-[11px] text-faint sm:block" aria-hidden="true">/</kbd>
                </label>
                <button type="button" aria-expanded={moreOpen} aria-controls="dir-more-filters" onClick={() => setMoreOpen((v) => !v)}
                  className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood", moreOpen || moreCount ? "bg-ink text-parchment" : "border border-rule bg-paper text-ink hover:bg-cream")}>
                  <SlidersHorizontal className="size-4" /> <span>Filters</span>
                  {moreCount ? <span className="rounded-full bg-gold px-1.5 text-[11px] font-semibold leading-5 text-ink" aria-label={`${moreCount} more filters on`}>{moreCount}</span> : null}
                </button>
              </div>
              <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Kind of site">
                <ChipButton on={f.cat < 0} onClick={() => set("cat", -1)} count={data ? facets.catAll : undefined}>Everything</ChipButton>
                {meta?.categories.map((c, i) => (
                  <ChipButton key={c} on={f.cat === i} onClick={() => set("cat", f.cat === i ? -1 : i)} count={facets.cat[i]} disabled={!facets.cat[i] && f.cat !== i}>{CHIP_LABEL[c] ?? c}</ChipButton>
                ))}
              </div>
              <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto overscroll-x-contain px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden" role="group" aria-label="Free or paid">
                {meta?.access.map((a, i) => (
                  <ChipButton key={a} on={f.acc.includes(i)} onClick={() => set("acc", toggleIn(f.acc, i))} count={facets.acc[i]}>{ACCESS_LABEL[a]}</ChipButton>
                ))}
                <span className="mx-1 hidden w-px self-stretch bg-rule sm:block" aria-hidden="true" />
                <ChipButton on={f.region === "CA"} onClick={() => setF((p) => ({ ...p, region: p.region === "CA" ? "all" : "CA", prov: "" }))} count={data ? facets.region.CA ?? 0 : undefined}>
                  <span aria-hidden="true" className="mr-1.5 text-[13px] leading-none">🍁</span>Canadian
                </ChipButton>
              </div>
              {moreOpen ? (
                <div id="dir-more-filters" className="mt-3 max-h-[55vh] overflow-y-auto border-t border-rule pt-3">
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

            <div id="results" className="mt-5 flex scroll-mt-48 flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-faint" aria-live="polite">
                {data ? <>{fmtNum(results.length)} {results.length === 1 ? (filtersOn ? "site matches your search" : `site in the ${DIRECTORY_SHORT}`) : (filtersOn ? "sites match your search" : `sites in the ${DIRECTORY_SHORT}`)}</> : failed ? "" : `Loading the ${DIRECTORY_SHORT}`}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {filtersOn ? <button type="button" onClick={() => setF(EMPTY)} className="inline-flex items-center gap-1 text-sm font-medium text-oxblood hover:underline"><X className="size-4" /> Clear filters</button> : null}
                <a href={suggestHref(`${DIRECTORY_SHORT} suggestion`, SUGGEST_BODY)} className="inline-flex items-center gap-1.5 text-sm font-medium text-ink hover:text-oxblood"><Send className="size-4" /> Suggest a site</a>
              </div>
            </div>

            {failed ? (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">{DIRECTORY_NAME} did not load.</p>
                <p className="mt-2 text-sm text-muted">Check your connection, then try again.</p>
                <Button className="mt-4" variant="outline" onClick={load}>Try again</Button>
              </div>
            ) : !data ? (
              <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">{Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}</ul>
            ) : results.length ? (
              <>
                <h2 className="sr-only">Reading sites</h2>
                <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((s) => <SiteCard key={s.i} s={s} meta={meta!} />)}</ul>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <p className="text-sm text-faint">Showing {fmtNum(visible.length)} of {fmtNum(results.length)}</p>
                  {results.length > visible.length ? <Button variant="outline" onClick={() => setLimit((n) => n + PAGE)}>Show {Math.min(PAGE, results.length - visible.length)} more</Button> : null}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">Nothing matches that yet.</p>
                <p className="mt-2 text-sm text-muted">Try fewer filters, or tell us about a site we should add.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" onClick={() => setF(EMPTY)}>Clear filters</Button>
                  <Button asChild><a href={suggestHref(`${DIRECTORY_SHORT} suggestion`, SUGGEST_BODY)}>Suggest a site</a></Button>
                </div>
              </div>
            )}

            <div className="mt-16 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="rounded-xl bg-cream p-6 shadow-[var(--shadow-border)]">
                <p className="kicker kicker-jade">How it works</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">Gathered with care, checked at the source.</h2>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />Every site comes from public lists, library records and reading communities, then gets one polite visit from our checker. We respect each site's wishes about automated visits.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />Free means you can read there without paying. Paid means the site sells books, issues or subscriptions. Free and paid means a bit of both.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />Access not yet confirmed means we could not tell yet. Hover or tap a label to see what it is based on.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-jade shrink-0" aria-hidden="true" />{DIRECTORY_NAME} grow as we find more sites. Details change, so check each site before you buy or submit.</li>
                </ul>
              </div>
              <div id="suggest" className="flex flex-col rounded-xl bg-ink p-6 text-parchment shadow-[var(--shadow-border)]">
                <p className="kicker kicker-inverse">Know a good one?</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">Suggest a site.</h2>
                <p className="mt-3 text-sm leading-relaxed text-parchment/80">Small presses, local bookshops, little magazines and free archives are exactly what we want to hear about, especially Canadian ones. Send us the name and address, and we will take a look.</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Button asChild className="bg-gold text-ink hover:bg-gold-soft"><a href={suggestHref(`${DIRECTORY_SHORT} suggestion`, SUGGEST_BODY)}><Send className="size-4" /> Email a suggestion</a></Button>
                </div>
                <p className="mt-3 text-xs text-parchment/60">Spotted a mistake? Use the flag on any listing.</p>
              </div>
            </div>

            <aside className="mt-16" aria-labelledby="more-h">
              <div className="rule-floral" aria-hidden="true"><span className="rule-floral-mark"><span /></span></div>
              <p className="kicker mt-8 text-center">From Among The Letters</p>
              <h2 id="more-h" className="mt-2 text-center font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">Found something to read? There is more.</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {([
                  [Sparkles, "Afternoon Discoveries", "A free daily newsletter of stories, poems and essays worth your afternoon, with a different genre each day.", SUBSTACK_URL, "Read it free", true],
                  [ShoppingBag, "Guides for writers", "Practical PDF guides to finding the right places for your work and sending it out with confidence.", SHOP_URL, "Visit the shop", false],
                  [BookMarked, "Membership", "The full opportunities database, alerts and the paid newsletter, in one membership.", MEMBERSHIP_URL, "Compare plans", false],
                ] as const).map(([Icon, t, b, href, cta, ext]) => (
                  <div key={t} className="flex flex-col rounded-xl bg-cream p-5 shadow-[var(--shadow-border)]">
                    <span className="flex size-10 items-center justify-center rounded-full bg-oxblood/10 text-oxblood"><Icon className="size-5" strokeWidth={1.75} /></span>
                    <h3 className="mt-4 font-display text-xl tracking-tight text-ink">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                    <div className="mt-auto pt-4">
                      <a href={href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})} className="text-sm font-medium text-oxblood hover:underline">{cta} <ArrowUpRight className="inline size-3.5" /></a>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <BackToTop />
      <FlierPopup />
    </div>
  );
}
