/* A carved figure set faintly into the background of a card, panel or popup. Purely decorative.
   It sits behind the text inside the card's own box, so it never changes the card's size or covers anything.
   Which figure appears is picked from the seed, so each card keeps its own carving while the page is open,
   and different cards get different ones. */
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

/* The parent needs `relative`. dark=true for the deep coloured panels. */
export function CornerCarving({ set, seed = 0, index, className, flip, dark }: { set: CarvingSet; seed?: number; index?: number; className?: string; flip?: boolean; dark?: boolean }) {
  return (
    <span className="carving-bg" aria-hidden="true">
      <img src={carvingFor(set, seed, index)} alt="" loading="lazy" decoding="async" draggable={false}
        className={cn("corner-carving", `corner-carving-${set}`, dark && "corner-carving-dark", className)}
        style={flip ? { transform: "scaleX(-1)" } : undefined} />
    </span>
  );
}
