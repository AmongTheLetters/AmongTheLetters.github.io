import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/*
 * Featured piece, swapped about every two weeks.
 * To swap: drop the new PDF and cover into public/featured/,
 * update FEATURED below, and move the old one into PAST_FEATURED.
 */
export type FeaturedPiece = {
  title: string;
  deck: string;
  pdf: string;
  cover: string;
  coverWidth: number;
  coverHeight: number;
  date: string;
};

export const FEATURED: FeaturedPiece = {
  title: "When the Evenings Lengthen",
  deck: "Why stories feel different as the autumn dark comes early",
  pdf: "/featured/when-the-evenings-lengthen.pdf",
  cover: "/featured/when-the-evenings-lengthen-cover.webp",
  coverWidth: 680,
  coverHeight: 880,
  date: "October 2026",
};

/* Earlier featured pieces, newest first. */
export const PAST_FEATURED: FeaturedPiece[] = [];

export function Featured() {
  const f = FEATURED;
  return (
    <section id="featured" aria-labelledby="featured-heading" className="py-10 md:py-14">
      <div className="section-shell grid items-center gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-14">
        <a href={f.pdf} target="_blank" rel="noopener" className="mx-auto block w-full max-w-xs md:max-w-sm">
          <img
            src={f.cover}
            alt={`Cover of ${f.title}`}
            width={f.coverWidth}
            height={f.coverHeight}
            loading="lazy"
            className="h-auto w-full rounded-sm border border-rule shadow-lg transition-transform hover:-translate-y-1"
          />
        </a>
        <div className="max-w-xl">
          <p className="kicker">Featured · {f.date}</p>
          <h2 id="featured-heading" className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
            {f.title}
          </h2>
          <p className="mt-4 text-lg text-muted">{f.deck}</p>
          <Button asChild size="lg" className="mt-8">
            <a href={f.pdf} target="_blank" rel="noopener">
              Read the featured piece <ArrowUpRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
