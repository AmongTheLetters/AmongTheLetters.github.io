/* Shared pieces for The Topaz Pages: filter chips, the trust badge and the listing card. */
import {
  ArrowUpRight, BookMarked, Brush, Flag, Globe, Laptop, MapPin, Palette, PenLine, Printer, Check, CircleMinus, ShieldAlert, ShieldCheck, UserRound, X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CornerCarving } from "@/components/corner-carving";
import { placeLabel } from "@/lib/directory";
import { TOPAZ_SHORT, topazMail, trustLevel, trustSignals, type Service, type TopazRaw } from "@/lib/topaz";
import { cn } from "@/lib/utils";

/* Icons follow the category order in build_site_data.py. */
export const TOPAZ_CAT_ICON = [BookMarked, UserRound, PenLine, Palette, Brush, Printer];
export const TOPAZ_CHIP: Record<string, string> = {
  "Publishers & Presses": "Publishers", "Literary Agents": "Agents", "Editors & Proofreaders": "Editors",
  "Cover & Interior Design": "Design", "Picture Book & Children's Illustration": "Illustrators",
  "Printing, Audiobooks, ISBNs & Distribution": "Printing & Distribution",
};

export function TopazChip({ on, onClick, children, count, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      className={cn("inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood disabled:opacity-45",
        on ? "topaz-polish text-parchment" : "border border-topaz/35 bg-topaz/[0.05] text-topaz-deep hover:border-topaz/60 hover:bg-topaz/10")}>
      {children}{count !== undefined ? <span className={cn("ml-1.5 text-xs tabular-nums", on ? "text-parchment/80" : "text-faint")}>{count.toLocaleString("en-CA")}</span> : null}
    </button>
  );
}

export function TopazTag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "warm" | "sage" }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "warm" ? "bg-topaz/15 text-topaz-deep" : tone === "sage" ? "bg-jade/10 text-jade-deep" : "border border-topaz/30 bg-topaz/[0.05] text-topaz-deep")}>{children}</span>;
}

const TRUST_LABEL = { strong: "Strong signals", some: "Some signals", few: "Few signals", caution: "Caution" } as const;
const TRUST_HINT = {
  strong: "We confirmed four or more public facts about this service, such as a professional membership or a review page.",
  some: "We confirmed two or three public facts about this service. Check the details before you sign anything.",
  few: "We confirmed little about this service in public yet. That is not a bad sign on its own, so ask questions and read reviews.",
  caution: "An industry watchdog has raised concerns about this service. Read their advisory before you share money or a manuscript.",
} as const;

/* The badge opens a small info bubble, like the access badges on the Jade Pages. */
export function TrustBadge({ s }: { s: Service }) {
  const t = trustLevel(s);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: Event) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    document.addEventListener("pointerdown", onDown); document.addEventListener("keydown", onKey, true);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey, true); };
  }, [open]);
  const tone = t === "caution" ? "bg-oxblood text-parchment" : t === "strong" ? "topaz-polish text-parchment" : t === "some" ? "border border-topaz text-topaz-deep bg-cream" : "border border-dashed border-faint/60 text-muted bg-cream";
  const Icon = t === "caution" ? ShieldAlert : ShieldCheck;
  return (
    <span ref={wrap} className="relative inline-flex shrink-0">
      <button ref={btn} type="button" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((v) => !v)}
        className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-oxblood", tone)}>
        <Icon className="size-3" aria-hidden="true" />{TRUST_LABEL[t]}<span className="sr-only">, what this means</span>
      </button>
      {open ? (
        <span id={id} role="status" className="absolute right-0 top-[calc(100%+4px)] z-30 flex w-max max-w-[15rem] items-start gap-1.5 rounded-lg border border-topaz/30 bg-cream py-1.5 pl-3 pr-1 text-xs font-medium normal-case leading-relaxed tracking-normal text-ink shadow-lg">
          <span className="py-0.5"><span className="font-semibold">{TRUST_LABEL[t]}.</span> {TRUST_HINT[t]}{t !== "caution" ? " It is not a rating of their work." : ""}</span>
          <button type="button" aria-label="Close" onClick={() => { setOpen(false); btn.current?.focus(); }}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-faint hover:bg-topaz/10 hover:text-topaz-deep focus-visible:outline-2 focus-visible:outline-oxblood"><X className="size-3.5" aria-hidden="true" /></button>
        </span>
      ) : null}
    </span>
  );
}

/* The reviews link always goes somewhere useful. A real review page when we found one, otherwise a web search for "[name] reviews". */
export function reviewsLabel(s: Service, meta: TopazRaw) {
  const src = meta.review_sources[s.rs] ?? "search";
  if (src.startsWith("search")) return "Search for reviews";
  if (src === "ALLi service rating") return "ALLi rating";
  return `Reviews on ${src.replace(/ (profile|listing)$/, "")}`;
}
const reviewsHref = (s: Service, meta: TopazRaw) =>
  s.reviews && !(meta.review_sources[s.rs] ?? "search").startsWith("search") ? s.reviews : `https://www.google.com/search?q=${encodeURIComponent(`"${s.name}" reviews`)}`;

export function ServiceCard({ s, meta, as: El = "li", className }: { s: Service; meta: TopazRaw; as?: "li" | "div"; className?: string }) {
  const [why, setWhy] = useState(false);
  const whyId = useId();
  const place = placeLabel(s);
  const CatIcon = TOPAZ_CAT_ICON[s.cat] ?? BookMarked;
  const services = s.sv.map((x) => meta.services[s.cat]?.[x]).filter(Boolean).slice(0, 3);
  const formats = meta.formats.filter((_, b) => (s.fmt >> b) & 1);
  const ww = meta.works_with[s.ww];
  const sb = meta.submissions[s.sb];
  const bm = meta.business_models[s.bm];
  const mem = s.m.map((x) => meta.memberships[x]).filter(Boolean).slice(0, 2);
  const reviews = reviewsHref(s, meta);
  return (
    <El className={cn("topaz-card group relative flex min-w-0 flex-col rounded-xl bg-cream p-5", className)}>
      <CornerCarving set="topaz" seed={s.i} />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="kicker kicker-topaz flex min-w-0 items-start gap-1.5 [overflow-wrap:break-word]"><CatIcon className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" /><span className="min-w-0">{meta.categories[s.cat]}</span></p>
        <TrustBadge s={s} />
      </div>
      <h3 className="mt-2.5 min-w-0 font-display text-xl leading-snug tracking-tight text-ink [overflow-wrap:anywhere]">
        <a href={s.url} target="_blank" rel="noopener nofollow ugc" className="rounded-sm decoration-oxblood/40 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood">
          {s.name}<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1"><Globe className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{s.domain.replace(/^www\./, "")}</span></span>
        {place ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{place}</span> : null}
        {s.remote ? <span className="inline-flex items-center gap-1"><Laptop className="size-3.5 shrink-0" aria-hidden="true" />Works remotely</span> : null}
      </p>
      {s.caution ? <p className="mt-3 rounded-md border border-oxblood/30 bg-oxblood/[0.06] px-3 py-2 text-sm text-oxblood">Industry watchdogs have raised concerns about this service. Read the advisory before you share money or a manuscript.</p> : null}
      {s.desc ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{s.desc}</p> : <p className="mt-3 text-sm italic text-faint">No description yet.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {services.map((x) => <TopazTag key={x}>{x}</TopazTag>)}
        {ww ? <TopazTag tone="warm">For {ww}</TopazTag> : null}
        {sb ? <TopazTag tone={s.sb === 1 ? "sage" : "plain"}>{sb}{s.rp ? ", reading periods" : ""}</TopazTag> : null}
        {bm ? <TopazTag>{bm}</TopazTag> : null}
        {mem.map((x) => <TopazTag key={x} tone="warm">{x}</TopazTag>)}
        {formats.map((x) => <TopazTag key={x}>{x}</TopazTag>)}
        {s.kid ? <TopazTag tone="sage">Children's books</TopazTag> : null}
      </div>
      <div className="mt-3">
        <button type="button" aria-expanded={why} aria-controls={whyId} onClick={() => setWhy((v) => !v)} className="text-xs font-medium text-topaz-deep underline-offset-4 hover:underline">
          {why ? "Hide what we found" : "What we found"}
        </button>
        {why ? (
          <ul id={whyId} className="mt-1.5 space-y-1 text-xs leading-relaxed text-muted">
            {trustSignals(s, meta).map((x) => (
              <li key={x.text} className={cn("flex gap-2", !x.found && "text-faint")}>
                {x.found ? <Check className="mt-0.5 size-3.5 shrink-0 text-topaz" aria-hidden="true" /> : <CircleMinus className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />}
                <span><span className="sr-only">{x.found ? "Found: " : "Not found: "}</span>{x.text}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="mt-auto flex items-end gap-2 pt-4">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2">
          <Button asChild size="sm" variant="outline" className="topaz-outline-btn">
            <a href={s.url} target="_blank" rel="noopener nofollow ugc" aria-label={`Visit ${s.name} (opens in a new tab)`}>Visit site <ArrowUpRight className="size-4" /></a>
          </Button>
          <a href={reviews} target="_blank" rel="noopener nofollow" className="text-sm font-medium text-topaz-deep underline-offset-4 hover:underline">
            {reviewsLabel(s, meta)}<span className="sr-only"> for {s.name} (opens in a new tab)</span>
          </a>
        </div>
        <a href={topazMail(`${TOPAZ_SHORT} fix for ${s.domain}`, `Listing ${s.name} (${s.url})\n\nWhat needs fixing\n`)}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-topaz/10 hover:text-topaz-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-topaz"
          title="Suggest a correction" aria-label={`Suggest a correction for ${s.name}`}><Flag className="size-4" /></a>
      </div>
    </El>
  );
}
