/* Shared pieces for The Jade Pages: filter chips and the listing card. */
import {
  ArrowUpRight, Award, BookMarked, BookOpen, Feather, Flag, Globe, Headphones, LibraryBig, Mail, MapPin, MessagesSquare,
  Newspaper, PenLine, Store, TabletSmartphone, X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCESS_HINT, ACCESS_LABEL, DIRECTORY_SHORT, FORMAT_LABEL, languageName, placeLabel, suggestHref, type RawData, type Site } from "@/lib/directory";
import { cn } from "@/lib/utils";
import { CornerCarving } from "@/components/corner-carving";

export const CAT_ICON = [BookMarked, Newspaper, LibraryBig, Store, Award, Feather, PenLine, Headphones, TabletSmartphone, Mail, MessagesSquare];
/* Shorter names for the filter chips, so the bar stays compact. Cards keep the full category name. */
export const CHIP_LABEL: Record<string, string> = {
  "Publishers & Presses": "Publishers", "Literary Magazines & Journals": "Magazines & Journals", "Free Reading Libraries & Archives": "Libraries & Archives",
  "Literary Awards & Organizations": "Awards & Organizations", "Web Fiction, Serials & Webcomics": "Web Fiction & Comics",
  "Ebook Stores & Platforms": "Ebooks", "Book Reviews & Communities": "Reviews & Communities",
};

export function ChipButton({ on, onClick, children, count, disabled }: { on: boolean; onClick: () => void; children: React.ReactNode; count?: number; disabled?: boolean }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick} disabled={disabled}
      className={cn("inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood disabled:opacity-45",
        on ? "jade-polish text-parchment" : "border border-jade/30 bg-jade/[0.04] text-jade-deep hover:border-jade/60 hover:bg-jade/10")}>
      {children}{count !== undefined ? <span className={cn("ml-1.5 text-xs tabular-nums", on ? "text-parchment/75" : "text-faint")}>{count.toLocaleString("en-CA")}</span> : null}
    </button>
  );
}

/* Unconfirmed access is a small grey dot, so it never squeezes the category name. Tapping it opens a little info bubble. */
function AccessDot() {
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
  return (
    <span ref={wrap} className="relative inline-flex shrink-0">
      <button ref={btn} type="button" aria-label="Access not yet confirmed" aria-expanded={open} aria-controls={open ? id : undefined}
        onClick={() => setOpen((v) => !v)}
        className="access-dot inline-flex size-6 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-oxblood">
        <span className="block size-2.5 rounded-full bg-faint/55 ring-2 ring-faint/15" aria-hidden="true" />
      </button>
      {open ? (
        <span id={id} role="status" className="absolute right-0 top-[calc(100%+4px)] z-30 flex w-max max-w-[13rem] items-start gap-1.5 rounded-lg border border-jade/25 bg-cream py-1.5 pl-3 pr-1 text-xs font-medium normal-case tracking-normal text-ink shadow-lg">
          <span className="py-0.5">Access not yet confirmed</span>
          <button type="button" aria-label="Close" onClick={() => { setOpen(false); btn.current?.focus(); }}
            className="inline-flex size-6 shrink-0 items-center justify-center rounded-full text-faint hover:bg-jade/10 hover:text-jade-deep focus-visible:outline-2 focus-visible:outline-oxblood"><X className="size-3.5" aria-hidden="true" /></button>
        </span>
      ) : null}
    </span>
  );
}

export function AccessBadge({ access, evidence }: { access: string; evidence: string }) {
  if (access === "unconfirmed") return <AccessDot />;
  /* Jade variants. Paid deep solid, Free pale fill, Free and paid outlined, not confirmed grey dashed. */
  const tone = access === "free" ? "bg-jade/15 text-jade-deep ring-1 ring-jade/25" : access === "paid" ? "bg-jade-deep text-parchment" : access === "mixed" ? "border border-jade text-jade-deep bg-cream" : "border border-dashed border-faint/60 text-muted";
  const title = ACCESS_HINT[access] + (evidence ? `. Based on ${evidence}.` : ".");
  return <span title={title} className={cn("inline-flex shrink-0 items-center whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-semibold", tone)}>{ACCESS_LABEL[access]}<span className="sr-only">. {title}</span></span>;
}

export function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "sage" | "gold" }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", tone === "sage" ? "bg-jade/12 text-jade-deep" : tone === "gold" ? "bg-gold/15 text-[#5c4620]" : "border border-jade/25 bg-jade/[0.06] text-jade-deep")}>{children}</span>;
}

export function SiteCard({ s, meta, as: El = "li", className }: { s: Site; meta: RawData; as?: "li" | "div"; className?: string }) {
  const access = meta.access[s.acc];
  const formats = meta.formats.filter((_, b) => (s.fmt >> b) & 1);
  const genres = meta.genres.filter((_, b) => (s.gen >> b) & 1).slice(0, 2);
  const place = placeLabel(s);
  const CatIcon = CAT_ICON[s.cat] ?? BookOpen;
  return (
    <El className={cn("jade-card group relative flex min-w-0 flex-col rounded-xl bg-cream p-5", className)}>
      <CornerCarving set="jade" seed={s.i} className="bottom-2 right-2 h-[64px] max-w-[52px] sm:h-[78px] sm:max-w-[60px]" />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="kicker kicker-jade flex min-w-0 items-start gap-1.5 [overflow-wrap:break-word]"><CatIcon className="mt-px size-3.5 shrink-0" strokeWidth={1.75} aria-hidden="true" /><span className="min-w-0">{meta.categories[s.cat]}</span></p>
        <AccessBadge access={access} evidence={s.evidence} />
      </div>
      <h3 className="mt-2.5 min-w-0 font-display text-xl leading-snug tracking-tight text-ink [overflow-wrap:anywhere]">
        <a href={s.url} target="_blank" rel="noopener nofollow ugc" className="rounded-sm decoration-oxblood/40 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood">
          {s.name}<span className="sr-only"> (opens in a new tab)</span>
        </a>
      </h3>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
        <span className="inline-flex min-w-0 max-w-full items-center gap-1"><Globe className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{s.domain.replace(/^www\./, "")}</span></span>
        {place ? <span className="inline-flex items-center gap-1"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{place}</span> : null}
      </p>
      {s.desc ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted">{s.desc}</p> : <p className="mt-3 text-sm italic text-faint">No description yet.</p>}
      <div className="mt-3 flex flex-wrap gap-1.5 pr-12 sm:pr-14">
        {formats.map((f) => <Tag key={f}>{FORMAT_LABEL[f]}</Tag>)}
        {genres.map((g) => <Tag key={g} tone="sage">{g[0].toUpperCase() + g.slice(1)}</Tag>)}
        {s.subs ? <Tag tone="gold">Mentions submissions</Tag> : null}
        {s.lang && s.lang !== "en" ? <Tag>In {languageName(s.lang)}</Tag> : null}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pr-12 pt-4 sm:pr-14">
        <Button asChild size="sm" variant="outline" className="jade-outline-btn">
          <a href={s.url} target="_blank" rel="noopener nofollow ugc" aria-label={`Visit ${s.name} (opens in a new tab)`}>Visit site <ArrowUpRight className="size-4" /></a>
        </Button>
        <a href={suggestHref(`${DIRECTORY_SHORT} fix for ${s.domain}`, `Listing ${s.name} (${s.url})\n\nWhat needs fixing\n`)}
          className="inline-flex size-9 items-center justify-center rounded-md text-faint transition-colors hover:bg-jade/10 hover:text-jade focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-jade"
          title="Suggest a correction" aria-label={`Suggest a correction for ${s.name}`}><Flag className="size-4" /></a>
      </div>
    </El>
  );
}

