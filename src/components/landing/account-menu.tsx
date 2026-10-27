/* The account menu in the top bar, on every page. Signed out it offers sign in, sign up and membership.
   Signed in it links to the account, the database, notifications, the founding library and billing. */
import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Bell, BookOpen, CreditCard, Library, LogIn, LogOut, Sparkles, UserPlus, UserRound } from "lucide-react";
import { api, portalUrl } from "@/lib/backend";
import { MODE } from "@/lib/config";
import { MEMBERSHIP_URL } from "@/lib/site-content";
import { useAccount } from "@/lib/use-account";
import { cn } from "@/lib/utils";

type Item = { label: string; href?: string; onSelect?: () => void; icon: typeof Bell; badge?: number; tone?: "accent" };

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { ready, session, membership, member } = useAccount();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!member) { setUnread(0); return; }
    const load = () => api.listNotices().then((n) => setUnread(n.filter((x) => !x.readAt).length)).catch(() => undefined);
    load();
    window.addEventListener("focus", load);
    return () => window.removeEventListener("focus", load);
  }, [member]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("mousedown", onDown); document.addEventListener("touchstart", onDown); window.addEventListener("keydown", onKey);
    menu.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("touchstart", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  if (!ready) return <span className={cn("inline-block rounded-full", compact ? "size-11" : "size-9")} aria-hidden="true" />;

  const lifetime = member && membership?.source === "stripe" && membership.plan === "lifetime";
  const paysMonthlyOrYearly = member && membership?.source === "stripe" && (membership.plan === "monthly" || membership.plan === "annual");
  const signOut = async () => { await api.signOut(); window.location.href = MODE === "preview" ? window.location.pathname : "/"; };
  const billing = () => { if (MODE === "preview") { alert("Opens the secure Stripe billing page."); return; } const u = session ? portalUrl(session.email) : ""; if (u) window.location.href = u; };

  const items: Item[] = session
    ? [
        { label: "My account", href: "/account/", icon: UserRound },
        { label: "Opportunities database", href: "/opportunities/", icon: BookOpen },
        ...(member ? [{ label: "Notifications", href: "/account/#alerts", icon: Bell, badge: unread }] : []),
        ...(lifetime ? [{ label: "Founding library", href: "/account/#library", icon: Library }] : []),
        ...(paysMonthlyOrYearly ? [{ label: "Manage billing", onSelect: billing, icon: CreditCard }] : []),
        ...(member ? [] : [{ label: "Become a member", href: MEMBERSHIP_URL, icon: Sparkles, tone: "accent" as const }]),
      ]
    : [
        { label: "Sign in", href: "/account/", icon: LogIn },
        { label: "Create account", href: "/account/?mode=signup", icon: UserPlus },
        { label: "Membership", href: MEMBERSHIP_URL, icon: Sparkles, tone: "accent" },
      ];

  const onMenuKey = (e: ReactKeyboardEvent) => {
    const all = Array.from(menu.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? []);
    const i = all.indexOf(document.activeElement as HTMLElement);
    const go = (n: number) => { e.preventDefault(); all[(n + all.length) % all.length]?.focus(); };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(all.length - 1);
    else if (e.key === "Tab") setOpen(false);
  };

  const initial = session?.email?.trim()[0]?.toUpperCase() ?? "";
  const rowCls = "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-ink outline-none transition-colors hover:bg-ink/5 focus-visible:bg-ink/5 focus-visible:ring-2 focus-visible:ring-oxblood/40";

  return (
    <div ref={wrap} className="relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={session ? `Account menu for ${session.email}` : "Account menu, sign in or join"}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => { if (e.key === "ArrowDown" && !open) { e.preventDefault(); setOpen(true); } }}
        className={cn(
          "relative inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood",
          compact ? "size-11" : "size-9",
          session ? "" : "text-ink hover:bg-paper",
          !session && !compact && "bg-cream shadow-[var(--shadow-border)]",
        )}
      >
        {session ? (
          <span className={cn("flex size-8 items-center justify-center rounded-full font-display text-sm font-semibold", lifetime ? "bg-oxblood text-parchment ring-2 ring-gold/60" : member ? "bg-ink text-parchment" : "bg-paper text-ink ring-1 ring-rule-strong")}>{initial}</span>
        ) : (
          <UserRound className="size-[18px]" strokeWidth={1.75} />
        )}
      </button>

      {open ? (
        <div
          ref={menu}
          id="account-menu"
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="fixed inset-x-4 top-16 z-50 rounded-xl border border-rule bg-cream p-2 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-64"
        >
          {session ? (
            <div className="border-b border-rule px-3 pb-2.5 pt-1.5">
              <p className="truncate text-sm font-medium text-ink">{session.email}</p>
              <p className="mt-0.5 text-xs text-faint">{lifetime ? "Founding member" : member ? (membership?.source === "substack" ? "Member through Substack" : "Member") : "Free account"}</p>
            </div>
          ) : (
            <p className="border-b border-rule px-3 pb-2.5 pt-1.5 text-xs text-muted">Save searches, follow deadlines and open every listing as a member.</p>
          )}
          <div className="flex flex-col pt-1.5">
            {items.map((it) => {
              const inner = (
                <>
                  <it.icon className={cn("size-4 shrink-0", it.tone === "accent" ? "text-oxblood" : "text-muted")} strokeWidth={1.75} />
                  <span className={cn("flex-1", it.tone === "accent" && "text-oxblood")}>{it.label}</span>
                  {it.badge ? <span className="rounded-full bg-oxblood px-1.5 text-[11px] font-semibold leading-5 text-parchment" aria-label={`${it.badge} unread`}>{it.badge > 9 ? "9+" : it.badge}</span> : null}
                </>
              );
              return it.href ? (
                <a key={it.label} role="menuitem" tabIndex={-1} href={it.href} className={rowCls} onClick={() => setOpen(false)}>{inner}</a>
              ) : (
                <button key={it.label} role="menuitem" tabIndex={-1} type="button" className={rowCls} onClick={() => { setOpen(false); it.onSelect?.(); }}>{inner}</button>
              );
            })}
            {session ? (
              <button role="menuitem" tabIndex={-1} type="button" onClick={signOut} className={cn(rowCls, "mt-1 border-t border-rule pt-1 text-muted")}>
                <LogOut className="size-4 shrink-0 text-muted" strokeWidth={1.75} /><span className="flex-1">Sign out</span>
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
