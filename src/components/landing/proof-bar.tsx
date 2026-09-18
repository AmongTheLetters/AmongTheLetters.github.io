import { PROOF } from "@/lib/site-content";

export function ProofBar() {
  return (
    <section aria-label="At a glance" className="border-y border-rule bg-cream">
      <div className="section-shell grid grid-cols-2 divide-x divide-rule md:grid-cols-4">
        {PROOF.map((item) => (
          <div key={item.value} className="px-4 py-7 md:px-6 md:py-8">
            <p className="font-display text-xl tracking-tight text-ink md:text-2xl">
              {item.value}
            </p>
            <p className="mt-1.5 text-sm text-muted">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
