/* The Topaz Pages. A free directory of publishing services (presses, agents, editors, designers, illustrators,
   printers and distributors), built like the Jade Pages and tuned to warm golden topaz. Listings are information,
   never endorsements. Each card shows the public signals we found and a link to reviews. */
import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowUpRight, BookMarked, ChevronDown, Dices, RefreshCw, Search, ShoppingBag, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CornerCarving } from "@/components/corner-carving";
import { ServiceCard, TopazChip, TOPAZ_CHIP } from "@/components/topaz-ui";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { MEMBERSHIP_URL, SHOP_URL, SUBSTACK_URL } from "@/lib/site-content";
import { siteRequest, useDirectoryPages } from "@/lib/site-api";
import {
  TOPAZ_EMPTY, TOPAZ_NAME, TOPAZ_SHORT, TRUST_LEVELS, topazFromUrl, topazMail, topazToUrl,
  type Service, type TopazFilters, type TopazRaw,
} from "@/lib/topaz";
import { cn } from "@/lib/utils";

const PAGE = 24;
const SUGGEST_BODY = "Business name\n\nWeb address\n\nWhat they offer authors\n\nWhere they are based\n\nHow you know them\n";

/* The ATL rose from the featured articles, recoloured in polished topaz (public/images/topaz-rose.svg). */
function TopazRose({ className }: { className?: string }) {
  return <img src="/images/topaz-rose.svg" alt="" aria-hidden="true" width={48} height={42} className={className} />;
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

/* "Find me a service". Picks one listing at random from what the reader's filters match. */
function PickDialog({ open, onClose, filters, total, meta }: { open: boolean; onClose: () => void; filters: TopazFilters; total: number; meta: TopazRaw | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [pick, setPick] = useState<Service | null>(null);
  const [spin, setSpin] = useState(0);
  const seen = useRef<Set<number>>(new Set());
  const drawAbort = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const draw = async () => {
    drawAbort.current?.abort(); const controller = new AbortController(); drawAbort.current = controller;
    setBusy(true); setError(""); setPick(null);
    try {
      const response = await siteRequest<Service, TopazRaw>("topaz", "pick", filters, { exclude: [...seen.current], signal: controller.signal });
      if (controller.signal.aborted) return;
      const item = response.items[0];
      if (item) { if (seen.current.has(item.i)) seen.current.clear(); seen.current.add(item.i); setPick(item); setSpin((n) => n + 1); }
    } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "A service could not be picked."); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { draw(); d.showModal(); }
    if (!open) { drawAbort.current?.abort(); if (d.open) d.close(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="tz-pick-title" onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="topaz-dialog topaz-focus m-auto w-[min(40rem,calc(100vw-1.5rem))] max-h-[min(46rem,calc(100dvh-1.5rem))] overflow-hidden rounded-2xl bg-cream p-0 text-ink">
      <div className="flex max-h-[inherit] flex-col">
        <div className="topaz-deep-panel relative flex items-start justify-between gap-4 px-5 pb-4 pt-5 text-parchment sm:px-6">
          <CornerCarving set="topaz" seed={spin + 2} dark />
          <div>
            <p className="kicker kicker-inverse">{TOPAZ_SHORT}</p>
            <h2 id="tz-pick-title" className="mt-1 font-display text-2xl font-medium tracking-tight">Here is one to look at</h2>
            <p className="mt-1 text-sm text-parchment/75">Picked at random from what your filters match.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-parchment/80 hover:bg-white/10 hover:text-parchment"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto p-5 sm:p-6">
          {busy ? <p className="text-sm text-muted" aria-live="polite">Finding a service</p> : error ? <p role="alert" className="text-sm text-muted">{error}</p> : pick && meta ? <ServiceCard key={pick.i} s={pick} meta={meta} as="div" /> : <p className="text-sm text-muted">Nothing matches those filters yet. Clear a filter or two, then try again.</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-topaz/20 px-5 py-4 sm:px-6">
          <Button variant="outline" className="topaz-outline-btn" onClick={onClose}>Done</Button>
          <Button className="topaz-polish text-parchment hover:brightness-110" onClick={draw} disabled={!total || busy}><RefreshCw className="size-4" /> Another</Button>
        </div>
      </div>
    </dialog>
  );
}

export function TopazApp() {
  const [f, setF] = useState<TopazFilters>(() => (typeof window === "undefined" ? TOPAZ_EMPTY : topazFromUrl()));
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { data, busy, error, failure, loadMore, reload: load } = useDirectoryPages<Service, TopazRaw>("topaz", f);
  const state = error && failure !== "more" ? "failed" : data ? "ready" : "loading";
  useEffect(() => { topazToUrl(f); }, [f]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === "/" && !/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) && !t.isContentEditable) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const set = <K extends keyof TopazFilters>(k: K, v: TopazFilters[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const meta = data?.meta;
  const visible = data?.items ?? [];
  const total = data?.total ?? 0;
  const facets = { cat: data?.facets.cat ?? [], all: data?.facets.all ?? 0 };
  const totals = data?.totals ?? { all: 0, canada: 0, open: 0 };
  const moreCount = (f.ww ? 1 : 0) + f.aud.length + f.trust.length + (f.priced ? 1 : 0) + (f.member ? 1 : 0);
  const activeCount = (f.cat >= 0 ? 1 : 0) + (f.open ? 1 : 0) + (f.remote ? 1 : 0) + (f.canada ? 1 : 0) + moreCount;
  const filtersOn = !!f.q || activeCount > 0;
  const fmtNum = (n: number) => n.toLocaleString("en-CA");
  const selectCls = "mt-1 h-11 w-full rounded-md border border-topaz/40 bg-cream px-3 text-base text-ink sm:h-10 sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood";
  const ready = state === "ready";

  return (
    <div id="top" className="topaz-focus relative isolate min-h-dvh overflow-x-clip bg-news text-ink">
      <a href="#results" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to the listings</a>
      <SiteHeader />

      <main>
        <section className="topaz-band pb-8 pt-12 md:pb-10 md:pt-16">
          <div className="section-shell flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="kicker kicker-topaz">A free publishing services directory</p>
              <div className="mt-2 flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
                <TopazRose className="h-14 w-auto shrink-0 drop-shadow-[0_1px_1px_rgba(107,66,8,0.3)] sm:h-20" />
                <h1 className="topaz-script whitespace-nowrap text-[2.9rem] leading-[1.15] min-[400px]:text-[3.3rem] sm:text-[5.2rem] md:text-[6rem]">{TOPAZ_NAME}</h1>
              </div>
              <div className="topaz-rule mt-1 w-28" aria-hidden="true" />
              <p className="text-on-open mt-4 font-display text-2xl font-medium leading-snug tracking-tight text-ink md:text-3xl">The people who help books get made, in one free directory.</p>
              <p className="text-on-open mt-3 max-w-xl text-lead text-muted">Publishers, literary agents, editors, designers, illustrators, printers and distributors, from Canada and beyond. Every listing shows the public signals we found and where to read reviews, so you can check before you sign anything.</p>
              <Button className="topaz-polish mt-5 text-parchment hover:brightness-110" onClick={() => setPickOpen(true)} aria-haspopup="dialog" disabled={!ready}><Dices className="size-4" /> Find me a service</Button>
            </div>
            <div className="topaz-stat topaz-card grid min-w-0 grid-cols-3 divide-x divide-topaz/25 rounded-xl bg-cream lg:w-[26rem]">
              {([[totals.all, "services listed"], [totals.canada, "based in Canada"], [totals.open, "open to unagented"]] as const).map(([n, l]) => (
                <div key={l} className="p-4 text-center">
                  <p className="font-display text-3xl tracking-tight text-topaz tabular-nums">{data ? fmtNum(n) : state === "loading" ? <span className="inline-block h-8 w-14 animate-pulse rounded bg-ink/10 align-middle" /> : "Soon"}</p>
                  <p className="mt-1 text-xs leading-snug text-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28">
          <div className="section-shell">
            {data ? (
              <div className="topaz-card sticky top-16 z-20 -mx-4 border-b border-topaz/25 bg-cream/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-cream/90 sm:mx-0 sm:rounded-xl sm:border-b-0 sm:p-4">
                <CornerCarving set="topaz" index={0} />
                <div className="flex gap-2">
                  <label className="relative block min-w-0 flex-1">
                    <span className="sr-only">Search {TOPAZ_NAME}</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-topaz" aria-hidden="true" />
                    <input ref={searchRef} type="search" value={f.q} onChange={(e) => set("q", e.target.value)} enterKeyHint="search" autoComplete="off"
                      placeholder="Search names, services, places"
                      className="h-11 w-full rounded-md border border-topaz/40 bg-paper pl-9 pr-10 text-base text-ink placeholder:text-faint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood sm:text-sm" />
                    <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border border-topaz/35 px-1.5 text-[11px] text-topaz sm:block" aria-hidden="true">/</kbd>
                  </label>
                  <button type="button" aria-expanded={panelOpen} aria-controls="tz-panel" onClick={() => setPanelOpen((v) => !v)}
                    className={cn("inline-flex h-11 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors", panelOpen || activeCount ? "topaz-polish text-parchment" : "border border-topaz/40 bg-paper text-topaz-deep hover:bg-topaz/10")}>
                    <SlidersHorizontal className="size-4" aria-hidden="true" />
                    <span>Filters{activeCount ? ` (${activeCount})` : ""}</span>
                    <ChevronDown className={cn("size-4 transition-transform duration-200 motion-reduce:transition-none", panelOpen && "rotate-180")} aria-hidden="true" />
                  </button>
                </div>
                {panelOpen ? (
                  <div id="tz-panel" className="max-h-[62vh] overflow-y-auto overscroll-contain pt-3 md:max-h-none md:overflow-visible">
                    <div className="flex flex-wrap gap-2" role="group" aria-label="Kind of service">
                      <TopazChip on={f.cat < 0} onClick={() => set("cat", -1)} count={facets.all}>Everything</TopazChip>
                      {meta?.categories.map((c, i) => (
                        <TopazChip key={c} on={f.cat === i} onClick={() => set("cat", f.cat === i ? -1 : i)} count={facets.cat[i]} disabled={!facets.cat[i] && f.cat !== i}>{TOPAZ_CHIP[c] ?? c}</TopazChip>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Quick filters">
                      <TopazChip on={f.canada} onClick={() => set("canada", !f.canada)}><span aria-hidden="true" className="mr-1.5 text-[13px] leading-none">🍁</span>Canadian</TopazChip>
                      <TopazChip on={f.remote} onClick={() => set("remote", !f.remote)}>Works remotely</TopazChip>
                      <TopazChip on={f.open} onClick={() => set("open", !f.open)}>Open to unagented authors</TopazChip>
                    </div>
                    <div className="mt-3 border-t border-topaz/20 pt-3">
                      <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)} className="inline-flex items-center gap-1 text-sm font-medium text-topaz-deep hover:underline">
                        {moreOpen ? "Fewer options" : "Who they work with, readership, signals and pricing"}{moreCount ? ` (${moreCount} on)` : ""} <ChevronDown className={cn("size-4 transition-transform motion-reduce:transition-none", moreOpen && "rotate-180")} aria-hidden="true" />
                      </button>
                      {moreOpen ? (
                        <div className="mt-3 space-y-3">
                          <label className="block max-w-xs text-xs font-medium text-muted">Works with
                            <select value={f.ww} onChange={(e) => set("ww", Number(e.target.value))} className={selectCls}>
                              <option value={0}>Anyone</option><option value={1}>Self-publishing authors</option><option value={2}>Publishers</option>
                            </select>
                          </label>
                          {meta?.audiences.length ? (
                            <fieldset><legend className="text-xs font-medium text-muted">Readership, where known <span className="text-faint">(any of the ones you pick)</span></legend>
                              <div className="mt-1.5 flex flex-wrap gap-2">{meta.audiences.map((a, i) => <TopazChip key={a} on={f.aud.includes(i)} onClick={() => set("aud", toggleIn(f.aud, i))}>{a}</TopazChip>)}</div>
                            </fieldset>
                          ) : null}
                          <fieldset><legend className="text-xs font-medium text-muted">Public signals</legend>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {TRUST_LEVELS.map((t) => <TopazChip key={t.key} on={f.trust.includes(t.key)} onClick={() => set("trust", toggleIn(f.trust, t.key))}>{t.label}</TopazChip>)}
                              <TopazChip on={f.member} onClick={() => set("member", !f.member)}>Belongs to a professional group</TopazChip>
                              <TopazChip on={f.priced} onClick={() => set("priced", !f.priced)}>Publishes its rates</TopazChip>
                            </div>
                          </fieldset>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div id="results" className="mt-5 flex scroll-mt-48 flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-faint" aria-live="polite">
                {ready ? <>{fmtNum(total)} {total === 1 ? (filtersOn ? "service matches your search" : `service in the ${TOPAZ_SHORT}`) : (filtersOn ? "services match your search" : `services in the ${TOPAZ_SHORT}`)}</> : state === "loading" ? `Loading the ${TOPAZ_SHORT}` : ""}
              </p>
              {filtersOn && data ? <button type="button" onClick={() => setF(TOPAZ_EMPTY)} className="inline-flex items-center gap-1 text-sm font-medium text-topaz-deep hover:underline"><X className="size-4" /> Clear filters</button> : null}
            </div>

            {error && failure === "more" ? <div role="alert" className="mt-3 rounded-xl border border-topaz/30 bg-cream p-4 text-sm text-muted"><p>{error}</p><Button variant="outline" className="topaz-outline-btn mt-3" onClick={load} disabled={busy}>Try again</Button></div> : null}
            {state === "failed" ? (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">{TOPAZ_NAME} did not load.</p>
                <p className="mt-2 text-sm text-muted">{error || "Check your connection, then try again."}</p>
                <Button className="topaz-outline-btn mt-4" variant="outline" onClick={load}>Try again</Button>
              </div>
            ) : state === "loading" ? (
              <ul className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
                {Array.from({ length: 6 }, (_, i) => <li key={i} aria-hidden="true" className="topaz-card h-56 animate-pulse rounded-xl bg-cream" />)}
              </ul>
            ) : total ? (
              <>
                <h2 className="sr-only">Publishing services</h2>
                <ul aria-busy={busy} className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map((s) => <ServiceCard key={s.i} s={s} meta={meta!} />)}</ul>
                <div className="mt-6 flex flex-col items-center gap-2">
                  <p className="text-sm text-topaz-deep">Showing {fmtNum(visible.length)} of {fmtNum(total)}</p>
                  {total > visible.length ? <Button variant="outline" className="topaz-outline-btn" onClick={loadMore} disabled={busy}>{busy ? "Loading listings" : `Show ${Math.min(PAGE, total - visible.length)} more`}</Button> : null}
                </div>
              </>
            ) : (
              <div className="mt-3 rounded-xl border border-dashed border-rule p-10 text-center">
                <p className="font-display text-xl text-ink">Nothing matches that yet.</p>
                <p className="mt-2 text-sm text-muted">Try fewer filters or a shorter search.</p>
                <Button variant="outline" className="topaz-outline-btn mt-4" onClick={() => setF(TOPAZ_EMPTY)}>Clear filters</Button>
              </div>
            )}

            <div className="mt-16 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
              <div className="topaz-card relative rounded-xl bg-cream p-6">
                <CornerCarving set="topaz" index={1} />
                <p className="kicker kicker-topaz">How it works</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight text-ink">Checked at the source, with reviews one tap away.</h2>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
                  <li className="flex gap-3"><span className="ornament mt-2 bg-topaz shrink-0" aria-hidden="true" />Listings come from public lists, professional associations and writing communities, then get one polite visit from our checker.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-topaz shrink-0" aria-hidden="true" />The signals badge counts what we could confirm in public, such as membership in a professional group or a real review page. It is not a rating of the work itself.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-topaz shrink-0" aria-hidden="true" />Services that industry watchdogs have warned about are marked in red, so you can read the advisory first.</li>
                  <li className="flex gap-3"><span className="ornament mt-2 bg-topaz shrink-0" aria-hidden="true" />A listing is information, never an endorsement. Read reviews, ask for references and never pay a reading fee to a literary agent.</li>
                </ul>
                <p className="mt-5 border-t border-topaz/20 pt-4 text-sm text-muted">Know a service we are missing, or one authors should avoid? <a href={topazMail(`${TOPAZ_SHORT} suggestion`, SUGGEST_BODY)} className="font-medium text-topaz-deep underline-offset-4 hover:underline">Email us</a>.</p>
              </div>
              <div className="topaz-deep-panel relative flex flex-col rounded-xl p-6 text-parchment">
                <CornerCarving set="topaz" index={3} dark />
                <p className="kicker kicker-inverse">Looking for readers instead?</p>
                <h2 className="mt-2 font-display text-3xl font-medium tracking-tight">Visit the Jade Pages.</h2>
                <p className="mt-3 text-sm leading-relaxed text-parchment/80">Our free reading directory of magazines, presses, libraries and bookshops, many of them open to submissions.</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  <Button asChild className="bg-gold text-ink hover:bg-gold-soft"><a href="/jade-pages/">Open the Jade Pages <ArrowUpRight className="size-4" /></a></Button>
                </div>
              </div>
            </div>

            <aside className="mt-16" aria-labelledby="tz-more-h">
              <p className="kicker kicker-topaz mt-8 text-center">From <em>Among The Letters</em></p>
              <div className="topaz-rule mx-auto mt-3 w-20" aria-hidden="true" />
              <h2 id="tz-more-h" className="mt-2 text-center font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">More help for your writing life.</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-3">
                {([
                  [Sparkles, "Afternoon Discoveries", "A free daily newsletter of stories, poems and essays worth your afternoon, with a different genre each day.", SUBSTACK_URL, "Read it free", true],
                  [ShoppingBag, "Guides for writers", "Practical PDF guides to finding the right places for your work and sending it out with confidence.", SHOP_URL, "Visit the shop", false],
                  [BookMarked, "Membership", "The full opportunities database, alerts and the paid newsletter, in one membership.", MEMBERSHIP_URL, "Compare plans", false],
                ] as const).map(([Icon, t, b, href, cta, ext], n) => (
                  <div key={t} className="topaz-card relative flex flex-col rounded-xl bg-cream p-5">
                    <CornerCarving set="topaz" index={n + 1} />
                    <span className="flex size-10 items-center justify-center rounded-full bg-topaz/12 text-topaz"><Icon className="size-5" strokeWidth={1.75} /></span>
                    <h3 className="mt-4 font-display text-xl tracking-tight text-ink">{t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted">{b}</p>
                    <div className="mt-auto pt-4">
                      <a href={href} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})} className="text-sm font-medium text-topaz-deep hover:underline">{cta} <ArrowUpRight className="inline size-3.5" /></a>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>
      </main>

      <PickDialog open={pickOpen} onClose={() => setPickOpen(false)} filters={f} total={total} meta={meta} />
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur topaz-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <BackToTop />
      <FlierPopup />
    </div>
  );
}
