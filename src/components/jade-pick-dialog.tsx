/* "Find me a site". A dialog that picks one listing at random, from everything (Surprise me) or from the
   reader's choices (Pick for me). Native <dialog> gives the focus trap, Esc to close and focus return. */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Dices, RefreshCw, Shuffle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipButton, CHIP_LABEL, SiteCard } from "@/components/jade-ui";
import { CornerCarving } from "@/components/corner-carving";
import {
  ACCESS_LABEL, DIRECTORY_SHORT, EMPTY, FILTER_FORMATS, FORMAT_LABEL, GENRE_GROUPS, LANGS, REGIONS, matches,
  type Filters, type Lang, type RawData, type Region, type Site,
} from "@/lib/directory";

type Choice = Pick<Filters, "cat" | "acc" | "gen" | "fmt" | "region" | "lang">;
const NONE: Choice = { cat: -1, acc: [], gen: [], fmt: [], region: "all", lang: "all" };
const toggleIn = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export function PickDialog({ open, onClose, sites, meta, initial }: { open: boolean; onClose: () => void; sites: Site[]; meta: RawData | undefined; initial: Choice }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [c, setC] = useState<Choice>(NONE);
  const [mode, setMode] = useState<"options" | "result">("options");
  const [kind, setKind] = useState<"surprise" | "pick">("pick");
  const [pick, setPick] = useState<Site | null>(null);
  const [note, setNote] = useState("");
  const [spin, setSpin] = useState(0);
  const seen = useRef<Set<number>>(new Set());
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) { setC({ ...initial }); setMode("options"); setPick(null); setNote(""); d.showModal(); requestAnimationFrame(() => d.querySelector<HTMLElement>("[data-autofocus]")?.focus()); }
    if (!open && d.open) d.close();
    // initial is read when the dialog opens
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const formats = meta?.formats ?? [];
  const pool = useMemo(() => sites.filter((s) => matches(s, { ...EMPTY, ...c }, [], formats)), [sites, c, formats]);
  const choicesOn = c.cat >= 0 || c.acc.length + c.gen.length + c.fmt.length > 0 || c.region !== "all" || c.lang !== "all";

  function draw(from: Site[], k: "surprise" | "pick") {
    setKind(k); setMode("result"); setNote("");
    if (!from.length) { setPick(null); return; }
    let fresh = from.filter((s) => !seen.current.has(s.i));
    if (!fresh.length) { from.forEach((s) => seen.current.delete(s.i)); fresh = from; setNote("You have seen every match, so we are starting the list again."); }
    const s = fresh[Math.floor(Math.random() * fresh.length)];
    seen.current.add(s.i); setPick(s); setSpin((n) => n + 1);
    requestAnimationFrame(() => headingRef.current?.focus());
  }
  const again = () => draw(kind === "surprise" ? sites : pool, kind);
  const back = () => { setMode("options"); requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus()); };

  const sel = "mt-1 h-11 w-full rounded-md border border-jade/40 bg-cream px-3 text-base text-ink sm:h-10 sm:text-sm";
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="pick-title"
      onClick={(e) => { if (e.target === ref.current) onClose(); }}
      className="jade-dialog jade-focus m-auto w-[min(40rem,calc(100vw-1.5rem))] max-h-[min(46rem,calc(100dvh-1.5rem))] overflow-hidden rounded-2xl bg-cream p-0 text-ink">
      <div className="flex max-h-[inherit] flex-col">
        <div className="jade-dialog-head relative flex items-start justify-between gap-4 px-5 pb-4 pt-5 sm:px-6">
          <CornerCarving set="jade" seed={spin + 1} className="bottom-1 right-16 h-[60px] max-w-[46px] sm:h-[70px] sm:max-w-[54px]" />
          <div className="pr-14">
            <p className="kicker kicker-inverse flex items-center gap-1.5"><Sparkles className="size-3.5" aria-hidden="true" /> Find me a site</p>
            <h2 id="pick-title" className="mt-1.5 font-display text-2xl font-medium tracking-tight text-parchment">{mode === "options" ? `Let the ${DIRECTORY_SHORT} choose.` : kind === "surprise" ? "A surprise, just for you." : "Picked for you."}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full text-parchment/85 transition-colors hover:bg-white/10 hover:text-parchment focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade-soft"><X className="size-5" /></button>
        </div>

        {mode === "options" ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <p className="text-sm text-muted">Choose what you are in the mood for, then let us pick one site at random. Leave everything open for a wider net.</p>
            <div className="mt-4 grid gap-3 min-[460px]:grid-cols-2">
              <label className="text-xs font-medium text-muted">Kind of site
                <select data-autofocus value={c.cat} onChange={(e) => setC({ ...c, cat: Number(e.target.value) })} className={sel}>
                  <option value={-1}>Any kind</option>
                  {meta?.categories.map((x, i) => <option key={x} value={i}>{CHIP_LABEL[x] ?? x}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">Region
                <select value={c.region} onChange={(e) => setC({ ...c, region: e.target.value as Region })} className={sel}>
                  {REGIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-muted">Language
                <select value={c.lang} onChange={(e) => setC({ ...c, lang: e.target.value as Lang })} className={sel}>{LANGS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              </label>
            </div>
            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-muted">Free or paid</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">{meta?.access.map((a, i) => <ChipButton key={a} on={c.acc.includes(i)} onClick={() => setC({ ...c, acc: toggleIn(c.acc, i) })}>{ACCESS_LABEL[a]}</ChipButton>)}</div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-muted">Genres, where known</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">{GENRE_GROUPS.map((g) => <ChipButton key={g.key} on={c.gen.includes(g.key)} onClick={() => setC({ ...c, gen: toggleIn(c.gen, g.key) })}>{g.label}</ChipButton>)}</div>
            </fieldset>
            <fieldset className="mt-4">
              <legend className="text-xs font-medium text-muted">Formats, where known</legend>
              <div className="mt-1.5 flex flex-wrap gap-2">{FILTER_FORMATS.map((x) => <ChipButton key={x} on={c.fmt.includes(x)} onClick={() => setC({ ...c, fmt: toggleIn(c.fmt, x) })}>{FORMAT_LABEL[x]}</ChipButton>)}</div>
            </fieldset>
            <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm text-jade" aria-live="polite">{pool.length.toLocaleString("en-CA")} {pool.length === 1 ? "site matches" : "sites match"} your choices{choicesOn ? "" : ", which is everything"}.</p>
              {choicesOn ? <button type="button" onClick={() => setC(NONE)} className="text-sm font-medium text-jade underline-offset-4 hover:underline">Clear choices</button> : null}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <h3 ref={headingRef} tabIndex={-1} className="sr-only">Your recommendation</h3>
            {pick && meta ? (
              <div key={spin} className="jade-reveal">
                <SiteCard s={pick} meta={meta} as="div" className="jade-pick-card" />
                {note ? <p className="mt-3 text-xs text-muted">{note}</p> : null}
                <p className="mt-3 text-xs text-faint">{kind === "surprise" ? `Chosen at random from all ${sites.length.toLocaleString("en-CA")} sites.` : `Chosen at random from ${pool.length.toLocaleString("en-CA")} ${pool.length === 1 ? "match" : "matches"}.`}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-jade/40 p-6 text-center">
                <p className="font-display text-xl text-ink">Nothing matches those choices yet.</p>
                <p className="mt-2 text-sm text-muted">Try fewer options, or let us surprise you with anything in the list.</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-nowrap items-center justify-end gap-2 border-t border-jade/20 bg-jade/[0.04] px-5 py-4 sm:px-6">
          {mode === "options" ? (
            <>
              <Button variant="outline" className="jade-outline-btn flex-1 sm:flex-none" onClick={() => draw(sites, "surprise")} disabled={!sites.length}><Shuffle className="size-4" /> Surprise me</Button>
              <Button className="jade-polish flex-1 text-parchment hover:brightness-110 sm:flex-none" onClick={() => draw(pool, "pick")} disabled={!sites.length}><Dices className="size-4" /> Pick for me</Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="jade-outline-btn flex-1 sm:mr-auto sm:flex-none" onClick={back}><ArrowLeft className="size-4" /> <span>Back<span className="max-[379px]:sr-only"> to options</span></span></Button>
              {pick ? <Button className="jade-polish flex-1 sm:flex-none text-parchment hover:brightness-110" onClick={again}><RefreshCw className="size-4" /> Another one</Button>
                : <Button className="jade-polish flex-1 sm:flex-none text-parchment hover:brightness-110" onClick={() => draw(sites, "surprise")}><Shuffle className="size-4" /> Surprise me</Button>}
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
export type { Choice };
