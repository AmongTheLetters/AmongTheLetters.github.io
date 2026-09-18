import { PRINCIPLES } from "@/lib/site-content";

export function Testimonials() {
  return (
    <section id="principles" className="scroll-mt-28 border-t border-rule bg-cream py-20 md:py-28">
      <div className="section-shell">
        <div className="max-w-2xl">
          <p className="kicker">The approach</p>
          <h2 className="mt-3 font-display text-masthead font-medium text-ink">A few things we care about.</h2>
          <p className="mt-4 text-lead text-muted">The internet is very good at giving us more. This is an attempt to be a little more selective about what is worth bringing back.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {PRINCIPLES.map((item) => (
            <article key={item.title} className="rounded-xl bg-paper p-6 shadow-[var(--shadow-border)] md:p-8">
              <h3 className="font-display text-2xl font-medium tracking-tight text-ink">{item.title}</h3>
              <p className="mt-3 text-muted">{item.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
