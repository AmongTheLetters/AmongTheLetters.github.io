import {
  Bookmark,
  BookOpen,
  Briefcase,
  CalendarDays,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { FEATURES } from "@/lib/site-content";

const ICONS = [ShieldCheck, Briefcase, BookOpen, CalendarDays, Mail, Bookmark];

export function Features() {
  return (
    <section id="inside" className="scroll-mt-28 border-t border-rule py-20 md:py-28">
      <div className="section-shell">
        <div className="max-w-2xl">
          <p className="kicker">How it works</p>
          <h2 className="mt-3 font-display text-masthead font-medium text-ink">
            Less searching. More finding.
          </h2>
          <p className="mt-4 max-w-xl text-lead text-muted">
            Good opportunities and good writing are scattered all over the place. We go looking, check what needs checking, and gather the pieces that seem worth your time.
          </p>
        </div>

        <div className="mt-12 grid gap-px overflow-hidden rounded-xl bg-rule shadow-[var(--shadow-border)] sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => {
            const Icon = ICONS[index] ?? ShieldCheck;
            return (
              <article key={feature.title} className="bg-paper p-6 md:p-7">
                <Icon className="size-5 text-oxblood" strokeWidth={1.75} />
                <h3 className="mt-4 font-display text-xl font-medium tracking-tight text-ink">
                  {feature.title}
                </h3>
                <p className="mt-2 text-muted">{feature.body}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
