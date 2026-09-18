import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FAQ } from "@/lib/site-content";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-28 py-20 md:py-28">
      <div className="section-shell grid gap-12 lg:grid-cols-2">
        <div>
          <p className="kicker">Questions</p>
          <h2 className="mt-3 font-display text-masthead font-medium text-ink">
            Straight answers.
          </h2>
          <p className="mt-4 max-w-sm text-muted">
            The briefing is published on Substack. Subscriptions and billing
            use Substack's own tools.
          </p>
        </div>
        <Accordion type="single" collapsible className="border-t border-rule">
          {FAQ.map((item, index) => (
            <AccordionItem key={item.q} value={`item-${index}`}>
              <AccordionTrigger>{item.q}</AccordionTrigger>
              <AccordionContent>{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
