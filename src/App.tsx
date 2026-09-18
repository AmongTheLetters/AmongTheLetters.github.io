import { Briefing } from "@/components/landing/briefing";
import { Faq } from "@/components/landing/faq";
import { Features } from "@/components/landing/features";
import { Genres } from "@/components/landing/genres";
import { Hero } from "@/components/landing/hero";
import { Pricing } from "@/components/landing/pricing";
import { ProofBar } from "@/components/landing/proof-bar";
import { SampleIssue } from "@/components/landing/sample-issue";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Subscribe } from "@/components/landing/subscribe";
import { Testimonials } from "@/components/landing/testimonials";

export function App() {
  return (
    <div id="top" className="relative min-h-dvh bg-paper text-ink">
      <a href="#briefing" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">Skip to content</a>
      <SiteHeader />
      <main>
        <Hero /><ProofBar /><Briefing /><Features /><SampleIssue /><Genres /><Pricing /><Testimonials /><Faq /><Subscribe />
      </main>
      <SiteFooter />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
