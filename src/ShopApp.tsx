import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  LockKeyhole,
  ShoppingBag,
  X,
  ZoomIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FlierPopup } from "@/components/landing/flier-popup";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SubstackLink } from "@/components/landing/substack-link";
import {
  COMPLETE_SET,
  GUIDES,
  SHOP_FAQ,
  SHOP_HIGHLIGHTS,
  SHOP_IMAGE_BASE,
  type ShopGuide,
  type ShopPreview,
} from "@/lib/shop-content";
import { cn } from "@/lib/utils";

const HIGHLIGHT_ICONS = [Download, LockKeyhole, CircleDollarSign] as const;

function coverSources(slug: string) {
  return {
    src: `${SHOP_IMAGE_BASE}/${slug}-cover-800.webp`,
    srcSet: `${SHOP_IMAGE_BASE}/${slug}-cover-480.webp 480w, ${SHOP_IMAGE_BASE}/${slug}-cover-800.webp 800w`,
  };
}

function previewThumb(slug: string) {
  return `${SHOP_IMAGE_BASE}/${slug}-360.webp`;
}

function previewFull(slug: string) {
  return `${SHOP_IMAGE_BASE}/${slug}-935.webp`;
}

function Cover({
  slug,
  alt,
  sizes,
  eager = false,
  className,
}: {
  slug: string;
  alt: string;
  sizes: string;
  eager?: boolean;
  className?: string;
}) {
  const { src, srcSet } = coverSources(slug);
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={alt}
      width={800}
      height={1200}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      className={cn(
        "img-frame aspect-[2/3] w-full rounded-md bg-cream object-cover shadow-[0_1px_2px_rgb(26_22_18/0.08),0_18px_40px_-18px_rgb(26_22_18/0.45)]",
        className,
      )}
    />
  );
}

function BuyButton({
  url,
  price,
  title,
  className,
}: {
  url: string;
  price: string;
  title: string;
  className?: string;
}) {
  return (
    <Button asChild size="lg" className={cn("min-w-0 max-w-full whitespace-normal text-center", className)}>
      <a href={url} target="_blank" rel="noopener" aria-label={`Buy ${title} on Payhip for ${price} (opens in a new tab)`}>
        <span>Buy on Payhip, {price}</span>
        <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
      </a>
    </Button>
  );
}

type LightboxState = { guide: ShopGuide; index: number } | null;

function PreviewLightbox({
  state,
  onClose,
  onStep,
}: {
  state: LightboxState;
  onClose: () => void;
  onStep: (direction: 1 | -1) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const open = state !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onStep(1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onStep(-1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onStep]);

  const preview = state ? state.guide.previews[state.index] : null;
  const total = state ? state.guide.previews.length : 0;

  return (
    <dialog
      ref={dialogRef}
      aria-label={preview ? `${state?.guide.title} sample page: ${preview.label}` : "Sample page"}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none items-center justify-center bg-transparent p-3 backdrop:bg-ink/70 backdrop:backdrop-blur-[2px] open:flex sm:p-6"
    >
      {state && preview ? (
        <figure className="relative flex max-h-full w-auto max-w-full flex-col rounded-xl bg-cream p-3 shadow-[var(--shadow-border-hover)] sm:p-4">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="absolute right-2 top-2 z-10 inline-flex size-10 items-center justify-center rounded-full border border-rule bg-paper text-ink shadow-[var(--shadow-border)] transition-colors hover:bg-oxblood hover:text-parchment focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
            aria-label="Close sample page"
          >
            <X className="size-4" strokeWidth={2.25} />
          </button>
          <img
            key={preview.slug}
            src={previewFull(preview.slug)}
            alt={preview.alt}
            width={935}
            height={1210}
            className="img-frame mx-auto h-auto max-h-[calc(100dvh-9.5rem)] w-auto max-w-full rounded-md bg-white object-contain sm:max-h-[calc(100dvh-10.5rem)]"
          />
          <figcaption className="mt-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onStep(-1)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-rule bg-paper text-ink transition-colors hover:border-rule-strong hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
              aria-label="Previous sample page"
            >
              <ChevronLeft className="size-4" strokeWidth={2.25} />
            </button>
            <div className="min-w-0 text-center">
              <p className="truncate font-display text-lg font-medium tracking-tight text-ink">{preview.label}</p>
              <p className="text-xs text-muted">
                {state.guide.title}, sample {state.index + 1} of {total}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onStep(1)}
              className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-rule bg-paper text-ink transition-colors hover:border-rule-strong hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
              aria-label="Next sample page"
            >
              <ChevronRight className="size-4" strokeWidth={2.25} />
            </button>
          </figcaption>
        </figure>
      ) : null}
    </dialog>
  );
}

function PreviewStrip({
  guide,
  onOpen,
}: {
  guide: ShopGuide;
  onOpen: (guide: ShopGuide, index: number) => void;
}) {
  return (
    <ul className="mt-4 grid grid-cols-3 gap-3 sm:gap-4">
      {guide.previews.map((preview: ShopPreview, index) => (
        <li key={preview.slug} className="min-w-0">
          <a
            href={previewFull(preview.slug)}
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
              event.preventDefault();
              onOpen(guide, index);
            }}
            className="group block rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-oxblood"
            aria-label={`View larger: ${preview.alt}`}
          >
            <span className="relative block overflow-hidden rounded-md bg-white shadow-[var(--shadow-border)] transition-[transform,box-shadow] duration-[var(--motion-fast)] ease-[var(--ease-out)] group-hover:-translate-y-0.5 group-hover:shadow-[var(--shadow-border-hover)]">
              <img
                src={previewThumb(preview.slug)}
                alt=""
                width={360}
                height={466}
                loading="lazy"
                decoding="async"
                className="aspect-[935/1210] w-full object-cover"
              />
              <span
                className="absolute bottom-2 right-2 inline-flex size-7 items-center justify-center rounded-full bg-cream/95 text-ink shadow-[var(--shadow-border)] transition-colors group-hover:bg-oxblood group-hover:text-parchment"
                aria-hidden="true"
              >
                <ZoomIn className="size-3.5" strokeWidth={2} />
              </span>
            </span>
            <span className="mt-2 block text-xs leading-snug text-muted group-hover:text-ink">{preview.label}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

function GuideCard({
  guide,
  onOpenPreview,
}: {
  guide: ShopGuide;
  onOpenPreview: (guide: ShopGuide, index: number) => void;
}) {
  const headingId = `${guide.id}-heading`;
  return (
    <article
      id={guide.id}
      aria-labelledby={headingId}
      className="relative scroll-mt-28 overflow-hidden rounded-xl bg-cream shadow-[var(--shadow-border)]"
    >
      <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: guide.accent }} aria-hidden="true" />
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-5 gap-y-7 p-6 sm:grid-cols-[8.5rem_minmax(0,1fr)] md:p-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-x-12 lg:p-10">
        <div className="lg:row-span-2">
          <Cover slug={guide.cover} alt={guide.coverAlt} sizes="(min-width: 1024px) 240px, 136px" />
        </div>

        <header className="min-w-0 self-center lg:self-start">
          <p className="kicker">{guide.number}</p>
          <h3 id={headingId} className="mt-2 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">
            {guide.title}
          </h3>
          <p className="mt-2 font-display text-lg italic leading-snug text-muted md:text-xl">{guide.subtitle}</p>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="font-display text-3xl tracking-tight text-ink">{guide.price}</span>
            <span className="text-sm text-muted">{guide.format}</span>
          </p>
        </header>

        <div className="col-span-2 min-w-0 lg:col-span-1 lg:col-start-2">
          <p className="max-w-2xl leading-relaxed text-muted">{guide.summary}</p>

          <p className="kicker mt-8">What's inside</p>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {guide.inside.map((item) => (
              <li key={item} className="flex min-w-0 gap-3 text-sm leading-snug text-ink">
                <Check className="mt-0.5 size-4 shrink-0 text-sage" strokeWidth={2.25} aria-hidden="true" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-8 border-t border-rule pt-6">
            <div className="flex items-baseline justify-between gap-4">
              <h4 className="kicker font-sans tracking-[var(--tracking-kicker)]">Look inside</h4>
              <p className="text-xs text-muted">Select a page to enlarge it</p>
            </div>
            <PreviewStrip guide={guide} onOpen={onOpenPreview} />
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <BuyButton url={guide.url} price={guide.price} title={guide.title} className="w-full sm:w-auto" />
            <p className="text-center text-sm text-muted sm:text-left">Instant PDF download. Price in CAD.</p>
          </div>
        </div>
      </div>
    </article>
  );
}

export function ShopApp() {
  const [lightbox, setLightbox] = useState<LightboxState>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openPreview = useCallback((guide: ShopGuide, index: number) => {
    triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLightbox({ guide, index });
  }, []);

  const closePreview = useCallback(() => {
    setLightbox(null);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    const target = document.getElementById(decodeURIComponent(hash));
    if (target) window.requestAnimationFrame(() => target.scrollIntoView({ block: "start" }));
  }, []);

  const stepPreview = useCallback((direction: 1 | -1) => {
    setLightbox((current) => {
      if (!current) return current;
      const total = current.guide.previews.length;
      return { guide: current.guide, index: (current.index + direction + total) % total };
    });
  }, []);

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#guides" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">
        Skip to the guides
      </a>
      <SiteHeader />

      <main>
        <section className="border-b border-rule pb-16 pt-12 md:pb-24 md:pt-20">
          <div className="section-shell">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.7fr)] lg:items-end">
              <div className="max-w-3xl">
                <div className="flex items-center gap-3 text-oxblood">
                  <ShoppingBag className="size-5" strokeWidth={1.75} aria-hidden="true" />
                  <p className="kicker">Among The Letters</p>
                </div>
                <h1 className="text-on-open mt-4 font-display text-masthead font-medium text-ink">Shop</h1>
                <p className="text-on-open mt-4 max-w-2xl text-balance font-display text-deck leading-snug tracking-tight text-ink">
                  Practical guides for writers, from Among The Letters.
                </p>
                <p className="text-on-open mt-5 max-w-2xl text-lead text-muted">
                  Clear, standalone handbooks for finding the right places for your writing and sending your work out with confidence. Buy once, download right away, and keep them for good.
                </p>
              </div>

              <aside aria-labelledby="buying-heading" className="rounded-xl border border-bark/25 bg-cream p-6 shadow-[var(--shadow-border)] md:p-7">
                <h2 id="buying-heading" className="font-sans text-sm font-medium tracking-normal text-muted">
                  How buying works
                </h2>
                <ul className="mt-5 space-y-5">
                  {SHOP_HIGHLIGHTS.map((item, index) => {
                    const Icon = HIGHLIGHT_ICONS[index];
                    return (
                      <li key={item.title} className="flex gap-4">
                        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-rule bg-paper text-oxblood" aria-hidden="true">
                          <Icon className="size-4" strokeWidth={1.75} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-display text-lg font-medium leading-snug tracking-tight text-ink">{item.title}</p>
                          <p className="mt-1 text-sm leading-relaxed text-muted">{item.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </aside>
            </div>
          </div>
        </section>

        <section id="guides" aria-labelledby="guides-heading" className="scroll-mt-28 py-20 md:py-28">
          <div className="section-shell">
            <div className="max-w-2xl">
              <p className="kicker">Writer's Guides</p>
              <h2 id="guides-heading" className="text-on-open mt-3 font-display text-4xl font-medium tracking-tight text-ink md:text-5xl">
                Two guides for the work around the writing.
              </h2>
              <p className="text-on-open mt-4 max-w-xl text-muted">
                One shows you where to send your work. The other shows you how to send it well. Each stands on its own, and together they cost less.
              </p>
            </div>

            <article
              id={COMPLETE_SET.id}
              aria-labelledby="complete-set-heading"
              className="mt-12 scroll-mt-28 overflow-hidden rounded-xl bg-ink text-parchment shadow-[var(--shadow-border)]"
            >
              <div className="grid gap-10 p-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] md:items-center md:p-10 lg:gap-14 lg:p-12">
                <div className="mx-auto w-full max-w-[17rem] md:max-w-[21rem]">
                  <Cover
                    slug={COMPLETE_SET.cover}
                    alt={COMPLETE_SET.coverAlt}
                    eager
                    sizes="(min-width: 768px) 336px, 272px"
                    className="outline-parchment/10"
                  />
                </div>

                <div className="min-w-0">
                  <p className="inline-flex items-center gap-2 rounded-full border border-parchment/25 px-3 py-1 text-xs font-medium uppercase tracking-[var(--tracking-kicker)] text-parchment/85">
                    <span className="ornament bg-[#f1c232]" aria-hidden="true" />
                    Best value
                  </p>
                  <h3 id="complete-set-heading" className="mt-5 font-display text-3xl font-medium tracking-tight md:text-4xl lg:text-5xl">
                    {COMPLETE_SET.title}
                  </h3>
                  <p className="mt-4 max-w-xl leading-relaxed text-parchment/75">{COMPLETE_SET.summary}</p>

                  <ul className="mt-7 grid gap-3">
                    {COMPLETE_SET.includes.map((item) => (
                      <li key={item.title} className="flex min-w-0 gap-3 text-sm leading-snug">
                        <Check className="mt-0.5 size-4 shrink-0 text-parchment" strokeWidth={2.25} aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="font-medium text-parchment">{item.title}</span>
                          <span className="text-parchment/65">, {item.detail}</span>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 border-t border-parchment/15 pt-7">
                    <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                      <span className="font-display text-5xl tracking-tight">{COMPLETE_SET.price}</span>
                      <span className="text-sm text-parchment/70">
                        <s className="decoration-parchment/50">{COMPLETE_SET.separatePrice}</s> when bought separately
                      </span>
                    </p>
                    <p className="mt-2 text-sm text-parchment/70">
                      Save {COMPLETE_SET.savings} with both guides and the tracker in one download.
                    </p>
                    <BuyButton
                      url={COMPLETE_SET.url}
                      price={COMPLETE_SET.price}
                      title={COMPLETE_SET.title}
                      className="mt-6 w-full sm:w-auto"
                    />
                  </div>
                </div>
              </div>
            </article>

            <div className="mt-16 flex items-center gap-4 md:mt-20">
              <p className="text-on-open shrink-0 font-display text-2xl font-medium tracking-tight text-ink">Or start with one guide</p>
              <span className="rule flex-1" aria-hidden="true" />
            </div>

            <div className="mt-8 space-y-8">
              {GUIDES.map((guide) => (
                <GuideCard key={guide.id} guide={guide} onOpenPreview={openPreview} />
              ))}
            </div>
          </div>
        </section>

        <section id="faq" aria-labelledby="faq-heading" className="scroll-mt-28 border-t border-rule py-20 md:py-28">
          <div className="section-shell grid gap-12 lg:grid-cols-2">
            <div>
              <p className="kicker">Questions</p>
              <h2 id="faq-heading" className="text-on-open mt-3 font-display text-masthead font-medium text-ink">
                Before you buy.
              </h2>
              <p className="text-on-open mt-4 max-w-sm text-muted">
                Checkout and delivery are handled by Payhip. For anything else, write to{" "}
                <a href="mailto:amongtheletters@gmail.com" className="font-medium text-oxblood underline-offset-4 hover:underline">
                  amongtheletters@gmail.com
                </a>
                .
              </p>
            </div>
            <Accordion type="single" collapsible className="rounded-xl border border-rule bg-cream px-5 shadow-[var(--shadow-border)] md:px-6">
              {SHOP_FAQ.map((item, index) => (
                <AccordionItem key={item.q} value={`item-${index}`}>
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="border-t border-rule bg-ink py-16 text-parchment md:py-20">
          <div className="section-shell flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="kicker kicker-inverse">The newsletter</p>
              <h2 className="mt-3 font-display text-4xl font-medium tracking-tight md:text-5xl">
                Prefer to have opportunities gathered for you?
              </h2>
              <p className="mt-4 max-w-xl text-parchment/70">
                Morning Opportunities brings checked writing work, contests, grants, residencies, and calls for submissions every Monday, with a free edition on Substack.
              </p>
            </div>
            <div className="flex w-full min-w-0 justify-center md:w-auto md:shrink-0 md:justify-end">
              <SubstackLink
                label="Read Among The Letters on Substack"
                invert
                className="h-auto min-h-11 w-full max-w-full whitespace-normal px-4 py-3 text-center text-sm sm:w-auto"
              />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
      <PreviewLightbox state={lightbox} onClose={closePreview} onStep={stepPreview} />
      <FlierPopup />
    </div>
  );
}
