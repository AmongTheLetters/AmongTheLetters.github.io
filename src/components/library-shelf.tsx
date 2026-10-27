import { useCallback, useEffect, useId, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Download, FileSpreadsheet, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHOP_IMAGE_BASE, type LibraryItem, type LibraryShelf } from "@/lib/shop-content";
import { cn } from "@/lib/utils";

const TILES = { spreadsheet: FileSpreadsheet, book: BookOpen, template: LayoutTemplate } as const;

/* One shelf of the founding member library. Phones get a sideways scroll-snap row with the next card peeking in,
   wider screens get a grid. The row is a labelled, focusable region, so arrow keys scroll it, and every download
   button stays in the normal tab order. */
export function LibraryShelfRow({ shelf, busy, onDownload }: { shelf: LibraryShelf; busy: string | null; onDownload: (fileId: string) => void }) {
  const headingId = useId();
  const rowRef = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });

  const measure = useCallback(() => {
    const el = rowRef.current; if (!el) return;
    setEdge({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);
  useEffect(() => {
    const el = rowRef.current; if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = new ResizeObserver(measure); ro.observe(el);
    return () => { el.removeEventListener("scroll", measure); ro.disconnect(); };
  }, [measure]);

  const step = (dir: 1 | -1) => {
    const el = rowRef.current; if (!el) return;
    const card = el.querySelector("li"); const gap = 16;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollBy({ left: dir * ((card?.clientWidth ?? el.clientWidth * 0.8) + gap), behavior: reduce ? "auto" : "smooth" });
  };
  const scrolls = edge.prev || edge.next;
  const count = shelf.items.length;

  return (
    <div className="mt-6 first:mt-5">
      <div className="flex items-end justify-between gap-3">
        <h3 id={headingId} className="kicker">{shelf.title} <span className="text-faint">· {count} {count === 1 ? "item" : "items"}</span></h3>
        {scrolls ? (
          <div className="flex gap-1.5 sm:hidden">
            <ArrowButton label={`Previous in ${shelf.title}`} disabled={!edge.prev} onClick={() => step(-1)}><ChevronLeft className="size-4" /></ArrowButton>
            <ArrowButton label={`Next in ${shelf.title}`} disabled={!edge.next} onClick={() => step(1)}><ChevronRight className="size-4" /></ArrowButton>
          </div>
        ) : null}
      </div>
      <ul ref={rowRef} role="list" tabIndex={scrolls ? 0 : -1} aria-labelledby={headingId}
        aria-description={scrolls ? "Scrolls sideways" : undefined}
        className={cn(
          "-mx-6 mt-3 flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto overscroll-x-contain px-6 pb-3",
          "[scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oxblood/40 focus-visible:ring-inset",
          "sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0",
        )}>
        {shelf.items.map((item, i) => (
          <LibraryCard key={item.id} item={item} position={`${i + 1} of ${count}`} busy={busy} onDownload={onDownload} />
        ))}
      </ul>
    </div>
  );
}

function ArrowButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick}
      className="flex size-8 items-center justify-center rounded-full bg-paper text-ink ring-1 ring-rule transition hover:text-oxblood disabled:opacity-35 disabled:hover:text-ink">
      {children}
    </button>
  );
}

function LibraryCard({ item, position, busy, onDownload }: { item: LibraryItem; position: string; busy: string | null; onDownload: (fileId: string) => void }) {
  const Tile = TILES[item.tile ?? "book"];
  return (
    <li aria-label={`${item.title}, ${position}`}
      className="flex w-[72%] max-w-[17rem] shrink-0 snap-start flex-col overflow-hidden rounded-lg bg-paper ring-1 ring-rule sm:w-auto sm:max-w-none">
      {item.cover ? (
        <img src={`${SHOP_IMAGE_BASE}/${item.cover}-cover-480.webp`} alt={`Cover of ${item.title}`} loading="lazy" width={480} height={720}
          className="aspect-[2/3] w-full bg-cream object-cover" />
      ) : (
        <div className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-3 bg-ink px-4 text-center text-parchment" aria-hidden="true">
          <Tile className="size-12 text-gold-soft" strokeWidth={1.25} />
          <span className="font-display text-lg tracking-tight">{item.title}</span>
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <h4 className="font-display text-xl tracking-tight text-ink">{item.title}</h4>
        <p className="mt-1 text-sm text-muted">{item.blurb}</p>
        <div className="mt-auto flex flex-col gap-2 pt-4">
          {item.files.map((f) => (
            <Button key={f.id} size="sm" variant={f.primary || item.files.length === 1 ? "default" : "outline"} disabled={busy !== null}
              onClick={() => onDownload(f.id)} className="w-full justify-between" aria-label={`Download ${item.title} as ${f.label}, ${f.detail}`}>
              <span className="inline-flex items-center gap-1.5"><Download className="size-4" /> {busy === f.id ? "Preparing…" : `Download ${f.label}`}</span>
              <span className="text-xs opacity-70">{f.detail}</span>
            </Button>
          ))}
        </div>
      </div>
    </li>
  );
}
