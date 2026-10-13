import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowUpRight, BookA, Check, Link2, Search, X } from "lucide-react";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { GLOSSARY, GLOSSARY_LINKS, GLOSSARY_SECTIONS, type GlossaryTerm } from "@/lib/glossary-data";
import { RESOURCES_URL } from "@/lib/site-content";
import { cn } from "@/lib/utils";

const BY_SLUG = new Map(GLOSSARY.map((t) => [t.slug, t]));
const byName = (a: GlossaryTerm, b: GlossaryTerm) => a.term.localeCompare(b.term, "en-CA", { sensitivity: "base" });
const letterOf = (t: GlossaryTerm) => t.term[0].toUpperCase();
const LETTERS = Array.from("ABCDEFGHIJKLMNOPQRSTUVWXYZ");
const PRESENT = new Set(GLOSSARY.map(letterOf));
type View = "section" | "az";

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function CopyLink({ slug, term }: { slug: string; term: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        const url = `${window.location.origin}${window.location.pathname}#${slug}`;
        try {
          await navigator.clipboard.writeText(url);
        } catch {
          window.location.hash = slug;
        }
        history.replaceState(null, "", `#${slug}`);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-rule bg-paper px-3 text-xs font-medium text-muted transition-colors hover:border-rule-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
      aria-label={copied ? `Link to ${term} copied` : `Copy link to ${term}`}
    >
      {copied ? <Check className="size-3.5 text-sage" aria-hidden="true" /> : <Link2 className="size-3.5" aria-hidden="true" />}
      <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
    </button>
  );
}

function TermEntry({ t, showSection }: { t: GlossaryTerm; showSection: boolean }) {
  const link = t.link ? GLOSSARY_LINKS[t.link] : undefined;
  const external = link?.href.startsWith("http");
  return (
    <article id={t.slug} aria-labelledby={`${t.slug}-h`} className="glossary-term scroll-mt-48 rounded-xl bg-cream p-6 shadow-[var(--shadow-border)] md:p-7">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {showSection ? <p className="kicker mb-2">{t.section}</p> : null}
          <h3 id={`${t.slug}-h`} className="font-display text-2xl font-medium tracking-tight text-ink">
            <a href={`#${t.slug}`} className="hover:text-oxblood">{t.term}</a>
          </h3>
        </div>
        <CopyLink slug={t.slug} term={t.term} />
      </header>
      <p className="mt-3 max-w-3xl leading-relaxed text-ink">{t.definition}</p>
      <div className="mt-4 max-w-3xl border-l-2 border-oxblood/60 pl-4">
        <p className="text-sm font-medium text-oxblood">What this means for you</p>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          {t.forYou}
          {link ? (
            <>
              {" "}
              <a href={link.href} {...(external ? { target: "_blank", rel: "noopener" } : {})} className="inline-flex items-center gap-0.5 font-medium text-oxblood underline-offset-4 hover:underline">
                {link.label}
                {external ? <ArrowUpRight className="size-3.5" aria-hidden="true" /> : null}
              </a>
            </>
          ) : null}
        </p>
      </div>
      {t.related.length ? (
        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
          <span className="text-faint">Related:</span>
          {t.related.map((r) => (
            <a key={r} href={`#${r}`} className="rounded-full border border-rule bg-paper px-2.5 py-0.5 text-muted hover:border-rule-strong hover:text-ink">
              {BY_SLUG.get(r)?.term ?? r}
            </a>
          ))}
        </p>
      ) : null}
    </article>
  );
}

export function GlossaryApp() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("section");
  const q = normalize(query.trim());

  const matches = useMemo(
    () =>
      GLOSSARY.filter((t) => !q || normalize(`${t.term} ${t.definition} ${t.forYou}`).includes(q)).sort(byName),
    [q],
  );

  useEffect(() => {
    const hash = decodeURIComponent(window.location.hash.slice(1));
    if (!hash) return;
    const go = () => document.getElementById(hash)?.scrollIntoView({ block: "start" });
    const id = window.setTimeout(go, 60);
    window.addEventListener("load", go, { once: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("load", go);
    };
  }, []);

  const groups: { id: string; title: string; items: GlossaryTerm[] }[] =
    view === "section"
      ? GLOSSARY_SECTIONS.map((s) => ({ id: `section-${s.toLowerCase().replace(/[^a-z]+/g, "-")}`, title: s, items: matches.filter((t) => t.section === s) }))
      : LETTERS.map((l) => ({ id: `letter-${l.toLowerCase()}`, title: l, items: matches.filter((t) => letterOf(t) === l) }));
  const visible = groups.filter((g) => g.items.length);
  const visibleLetters = new Set(matches.map(letterOf));

  const jumpToLetter = (l: string) => {
    if (view !== "az") setView("az");
    window.requestAnimationFrame(() => document.getElementById(`letter-${l.toLowerCase()}`)?.scrollIntoView({ block: "start", behavior: "smooth" }));
  };

  return (
    <div id="top" className="relative isolate min-h-dvh bg-news text-ink">
      <a href="#terms" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-oxblood focus:px-4 focus:py-2 focus:text-parchment">
        Skip to the terms
      </a>
      <SiteHeader />
      <main>
        <section className="border-b border-rule pb-12 pt-10 md:pb-16 md:pt-16">
          <div className="section-shell">
            <a href={RESOURCES_URL} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
              <ArrowLeft className="size-4" aria-hidden="true" /> Free Resources
            </a>
            <div className="mt-6 flex items-center gap-3 text-oxblood">
              <BookA className="size-5" strokeWidth={1.75} aria-hidden="true" />
              <p className="kicker">Glossary</p>
            </div>
            <h1 className="text-on-open mt-4 max-w-4xl font-display text-masthead font-medium text-ink">A plain-language glossary for writers</h1>
            <p className="text-on-open mt-5 max-w-2xl text-lead text-muted">
              {GLOSSARY.length} terms you will meet when sending work out, from reading periods to reprint rights, each with what it means in practice.
            </p>
          </div>
        </section>

        <div className="sticky top-16 z-20 border-b border-rule bg-cream/95 backdrop-blur-sm">
          <div className="section-shell flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <label className="relative block min-w-0 flex-1 sm:max-w-sm">
              <span className="sr-only">Search the glossary</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search terms and definitions"
                className="h-10 w-full rounded-md border border-rule bg-paper pl-9 pr-9 text-sm text-ink placeholder:text-faint focus:border-oxblood focus:outline-none"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:text-ink" aria-label="Clear search">
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </label>
            <nav aria-label="Jump to letter" className="order-last -mx-1 flex w-full min-w-0 justify-between gap-0.5 overflow-x-auto">
              {LETTERS.map((l) => {
                const on = PRESENT.has(l) && visibleLetters.has(l);
                return (
                  <button
                    key={l}
                    type="button"
                    disabled={!on}
                    onClick={() => jumpToLetter(l)}
                    className={cn("inline-flex size-8 shrink-0 sm:size-9 items-center justify-center rounded-md font-display text-sm", on ? "text-ink hover:bg-paper hover:text-oxblood" : "cursor-default text-faint/50")}
                    aria-label={on ? `Jump to ${l}` : `No terms under ${l}`}
                  >
                    {l}
                  </button>
                );
              })}
            </nav>
            <div role="group" aria-label="Arrange terms" className="ml-auto flex shrink-0 rounded-md border border-rule bg-paper p-0.5 text-sm">
              {(["section", "az"] as const).map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={cn("h-8 rounded-[5px] px-3 font-medium", view === v ? "bg-cream text-ink shadow-[var(--shadow-border)]" : "text-muted hover:text-ink")}>
                  {v === "section" ? "By topic" : "A to Z"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <section id="terms" aria-label="Glossary terms" className="scroll-mt-32 py-12 md:py-16">
          <div className="section-shell">
            <p className="text-sm text-muted" aria-live="polite">
              {q ? `${matches.length} of ${GLOSSARY.length} terms match “${query.trim()}”` : `${GLOSSARY.length} terms`}
            </p>
            {view === "section" && !q ? (
              <nav aria-label="Topics" className="mt-4 flex flex-wrap gap-2">
                {visible.map((g) => (
                  <a key={g.id} href={`#${g.id}`} className="rounded-full border border-rule bg-cream px-3.5 py-1.5 text-sm font-medium text-muted hover:text-ink">
                    {g.title} <span className="text-faint">{g.items.length}</span>
                  </a>
                ))}
              </nav>
            ) : null}
            {visible.length === 0 ? (
              <p className="mt-10 font-display text-2xl text-ink">No terms match that search. Try a shorter word.</p>
            ) : null}
            {visible.map((g) => (
              <section key={g.id} id={g.id} aria-labelledby={`${g.id}-h`} className="mt-12 scroll-mt-48 first-of-type:mt-10">
                <div className="flex items-center gap-4">
                  <h2 id={`${g.id}-h`} className="text-on-open shrink-0 font-display text-3xl font-medium tracking-tight text-ink md:text-4xl">{g.title}</h2>
                  <span className="rule flex-1" aria-hidden="true" />
                </div>
                <div className="mt-6 grid gap-5 lg:grid-cols-2">
                  {g.items.map((t) => (
                    <TermEntry key={t.slug} t={t} showSection={view === "az"} />
                  ))}
                </div>
              </section>
            ))}
            <p className="text-on-open mt-16 max-w-2xl text-sm text-muted">
              Definitions describe common usage. Publications and contests set their own terms, so each venue's guidelines and contract always come first. Spotted something to improve? Write to{" "}
              <a href="mailto:amongtheletters@gmail.com" className="font-medium text-oxblood underline-offset-4 hover:underline">amongtheletters@gmail.com</a>.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
      <div className="page-newsprint" aria-hidden="true" />
      <div className="page-fleur" aria-hidden="true" />
      <div className="page-grain" aria-hidden="true" />
    </div>
  );
}
