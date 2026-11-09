/* A small carved figure tucked into one corner of a card, panel or popup. Purely decorative.
   Which figure appears is picked from the seed, so each card keeps its own carving while the page is open,
   and different cards get different ones. The space it sits in is reserved by the card itself, so text never runs under it. */
import { cn } from "@/lib/utils";

export const CARVINGS = {
  jade: ["horse", "dragon", "crane", "lotus-vase"].map((n) => `/images/jade/jade-${n}.webp`),
  topaz: ["marigold", "queen-bee", "lantern", "phoenix"].map((n) => `/images/topaz/topaz-${n}.webp`),
} as const;
export type CarvingSet = keyof typeof CARVINGS;

/* Same seed, same figure. A small hash spreads neighbouring numbers across the set. */
const SALT = typeof window === "undefined" ? 0 : Math.floor(Math.random() * 1000);
export function carvingFor(set: CarvingSet, seed: number, index?: number) {
  const list = CARVINGS[set];
  if (index !== undefined) return list[((index % list.length) + list.length) % list.length];
  let h = (seed + SALT) * 2654435761;
  h = (h ^ (h >>> 13)) >>> 0;
  return list[h % list.length];
}

export function CornerCarving({ set, seed = 0, index, className, flip }: { set: CarvingSet; seed?: number; index?: number; className?: string; flip?: boolean }) {
  return (
    <img src={carvingFor(set, seed, index)} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable={false}
      className={cn("corner-carving pointer-events-none absolute select-none object-contain", `corner-carving-${set}`, className)}
      style={flip ? { transform: "scaleX(-1)" } : undefined} />
  );
}
