import { ArrowRight, ArrowUpRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UPCOMING_URL } from "@/lib/site-content";

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
  title: "Lantern Light and Low Voices",
  deck: "On the old pleasure of a story told to frighten, and why we still gather for it every October",
  pdf: "/featured/lantern-light-and-low-voices.pdf",
  cover: "/featured/lantern-light-and-low-voices-cover.webp",
  coverWidth: 680,
  coverHeight: 880,
  date: "Halloween 2026",
};

/* Earlier featured pieces, newest first. */
export const PAST_FEATURED: FeaturedPiece[] = [
  {
    title: "When the Evenings Lengthen",
    deck: "Why stories feel different as the autumn dark comes early",
    pdf: "/featured/when-the-evenings-lengthen.pdf",
    cover: "/featured/when-the-evenings-lengthen-cover.webp",
    coverWidth: 680,
    coverHeight: 880,
    date: "October 2026",
  },
];

/* File name readers get when they download, e.g. among-the-letters-lantern-light-and-low-voices.pdf */
export function downloadName(f: FeaturedPiece) {
  return `among-the-letters-${f.pdf.split("/").pop()}`;
}

export function Featured() {
  const f = FEATURED;
  return (
    <section id="featured" aria-labelledby="featured-heading" className="pt-8 pb-10 md:pt-10 md:pb-14">
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
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <a href={f.pdf} target="_blank" rel="noopener">
                Read the featured piece <ArrowUpRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={f.pdf} download={downloadName(f)}>
                Download PDF <Download className="size-4" />
              </a>
            </Button>
          </div>
          <a href={UPCOMING_URL} className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-oxblood underline-offset-4 hover:underline">
            See what is coming next <ArrowRight className="size-4" />
          </a>
        </div>
      </div>
    </section>
  );
}
