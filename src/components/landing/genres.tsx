import { GENRES } from "@/lib/site-content";

export function Genres() {
  return (
    <section className="py-20 md:py-28">
      <div className="section-shell">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-xl">
            <p className="kicker">The week in genre</p>
            <h2 className="mt-3 font-display text-masthead font-medium text-ink">
              Seven afternoons, a different corner of the bookshelf each day.
            </h2>
          </div>
          <p className="max-w-md text-muted">
            Afternoon Discoveries follows a seven-day genre rhythm. The themes guide the search without becoming a cage, and Sunday keeps its own discovery edition before the paid weekly roundup arrives that evening.
          </p>
        </div>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-xl bg-rule shadow-[var(--shadow-border)] sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {GENRES.map((item) => (
            <li key={item.day} className="flex min-h-44 flex-col justify-between bg-paper p-4">
              <p className="text-kicker font-medium uppercase tracking-kicker text-muted">{item.day}</p>
              <p className="font-display text-xl leading-snug tracking-tight text-ink">{item.genre}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
