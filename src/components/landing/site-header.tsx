import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/landing/wordmark";
import { NAV, SUBSTACK_URL } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b backdrop-blur-md transition-[background-color,box-shadow,border-color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        scrolled
          ? "border-rule bg-paper/88 shadow-[var(--shadow-border)]"
          : "border-transparent bg-paper/70",
      )}
    >
      <div className="section-shell flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-muted transition-colors duration-[var(--motion-quick)] hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden md:block">
          <Button asChild size="sm">
            <a href={SUBSTACK_URL} target="_blank" rel="noreferrer">
              Substack
            </a>
          </Button>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
      </div>

      {open ? (
        <div
          id="mobile-nav"
          className="border-t border-rule bg-paper md:hidden"
        >
          <nav className="section-shell flex flex-col py-4" aria-label="Mobile">
            {NAV.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex min-h-11 items-center font-display text-2xl tracking-tight text-ink"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </a>
            ))}
            <Button asChild className="mt-4">
              <a href={SUBSTACK_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                Substack
              </a>
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
