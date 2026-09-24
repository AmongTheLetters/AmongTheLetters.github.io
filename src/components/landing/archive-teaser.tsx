import { ArrowRight, LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ARCHIVE_URL } from "@/lib/site-content";

export function ArchiveTeaser() {
  return (
    <section className="border-t border-rule bg-ink py-16 text-parchment md:py-20">
      <div className="section-shell flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 text-parchment/70">
            <LibraryBig className="size-5" strokeWidth={1.75} />
            <p className="kicker kicker-inverse">The archive</p>
          </div>
          <h2 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
            Some letters are worth keeping within reach.
          </h2>
          <p className="mt-4 max-w-xl text-parchment/70">
            Browse published PDF editions by date and open the original issue when you want to return to something you found here.
          </p>
        </div>
        <Button asChild variant="outline" size="lg" className="shrink-0 border-parchment/30 text-parchment hover:bg-parchment hover:text-ink">
          <a href={ARCHIVE_URL}>Browse the archive <ArrowRight className="size-4" /></a>
        </Button>
      </div>
    </section>
  );
}
