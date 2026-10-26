import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/landing/wordmark";
import { NAV, SUBSTACK_URL } from "@/lib/site-content";
import { ACCOUNTS_ON } from "@/lib/config";
import { useAccount } from "@/lib/use-account";
import { NotificationBell } from "@/components/landing/notification-bell";
import { cn } from "@/lib/utils";

export function SiteHeader() {
  const { ready, session, member } = useAccount();
  const account = ACCOUNTS_ON && ready ? (session ? { label: "My account", href: "/account/" } : { label: "Sign in", href: "/account/" }) : undefined;
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "sticky top-0 z-30 border-b transition-[background-color,box-shadow,border-color] duration-[var(--motion-fast)] ease-[var(--ease-out)]",
        scrolled
          ? "border-rule bg-cream shadow-[var(--shadow-border)]"
          : "border-transparent bg-cream",
      )}
    >
      <div className="section-shell flex h-16 items-center justify-between gap-4">
        <Wordmark />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Primary">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm font-medium text-muted transition-colors duration-[var(--motion-quick)] hover:text-ink"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {member ? <NotificationBell /> : null}
          {account ? (
            <Button asChild size="sm" variant="outline">
              <a href={account.href}>{account.label}</a>
            </Button>
          ) : null}
          <Button asChild size="sm">
            <a href={SUBSTACK_URL} target="_blank" rel="noreferrer">
              Substack
            </a>
          </Button>
        </div>
        <div className="flex items-center gap-1 lg:hidden">
        {member ? <NotificationBell compact /> : null}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </Button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 top-16 z-30 cursor-default bg-ink/10 lg:hidden"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav"
            className="absolute right-4 top-[calc(100%+0.5rem)] z-40 w-60 max-w-[calc(100vw-2rem)] rounded-xl border border-rule bg-cream p-2 shadow-lg lg:hidden"
          >
            <nav className="flex flex-col" aria-label="Mobile">
              {NAV.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-ink transition-colors hover:bg-ink/5"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                </a>
              ))}
              {account ? (
                <a href={account.href} className="flex min-h-11 items-center rounded-lg px-3 text-base font-medium text-oxblood transition-colors hover:bg-ink/5" onClick={() => setOpen(false)}>
                  {account.label}
                </a>
              ) : null}
              <Button asChild size="sm" className="mx-1 mt-2 mb-1">
                <a href={SUBSTACK_URL} target="_blank" rel="noreferrer" onClick={() => setOpen(false)}>
                  Substack
                </a>
              </Button>
            </nav>
          </div>
        </>
      ) : null}
    </header>
  );
}
