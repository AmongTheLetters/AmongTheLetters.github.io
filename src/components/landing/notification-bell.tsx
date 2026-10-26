import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, CalendarClock, Check, Search, Settings } from "lucide-react";
import { api, type Notice } from "@/lib/backend";
import { timeAgo } from "@/lib/opportunities";
import { cn } from "@/lib/utils";

/** Opens a deep link. On the database page it is handled in place, elsewhere it navigates. */
export function openLink(link: string) {
  const u = new URL(link, window.location.origin);
  if (window.location.pathname === u.pathname) {
    window.history.pushState(null, "", u.pathname + u.search + u.hash);
    window.dispatchEvent(new Event("atl:deeplink"));
  } else window.location.href = u.pathname + u.search + u.hash;
}

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notice[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const unread = items.filter((n) => !n.readAt).length;

  const load = useCallback(() => { api.listNotices().then(setItems).catch(() => undefined); }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => { clearInterval(t); window.removeEventListener("focus", onFocus); };
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown); window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [open]);

  const go = async (n: Notice) => {
    setOpen(false);
    if (!n.readAt) { setItems((p) => p.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x))); api.markRead([n.id]).catch(() => undefined); }
    openLink(n.link);
  };
  const readAll = () => { setItems((p) => p.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() }))); api.markRead("all").catch(() => undefined); };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className={cn("relative inline-flex items-center justify-center rounded-md text-ink transition-colors hover:bg-paper", compact ? "size-11" : "size-9 shadow-[var(--shadow-border)] bg-cream")}>
        {unread ? <BellRing className="size-[18px]" /> : <Bell className="size-[18px]" />}
        {unread ? <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-oxblood px-1 text-[11px] font-semibold leading-5 text-parchment ring-2 ring-cream">{unread > 9 ? "9+" : unread}</span> : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="Notifications" className="fixed inset-x-4 top-16 z-50 overflow-hidden sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[22rem] rounded-xl border border-rule bg-cream shadow-xl">
          <div className="flex items-center justify-between border-b border-rule px-4 py-3">
            <p className="font-display text-lg tracking-tight text-ink">Notifications</p>
            {unread ? <button type="button" onClick={readAll} className="inline-flex items-center gap-1 text-xs font-medium text-oxblood hover:underline"><Check className="size-3.5" /> Mark all read</button> : null}
          </div>
          {items.length ? (
            <ul className="max-h-[26rem] divide-y divide-rule overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => go(n)} className={cn("flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-paper", !n.readAt && "bg-gold/[0.07]")}>
                    <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", n.kind === "closing_soon" || n.kind === "deadline_today" ? "bg-oxblood/10 text-oxblood" : "bg-sage/12 text-moss")}>
                      {n.kind === "closing_soon" || n.kind === "deadline_today" ? <CalendarClock className="size-4" /> : <Search className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-2"><span className={cn("text-sm leading-snug text-ink", !n.readAt && "font-semibold")}>{n.title}</span>{!n.readAt ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-oxblood" aria-label="Unread" /> : null}</span>
                      <span className="mt-0.5 block text-sm leading-snug text-muted">{n.body}</span>
                      <span className="mt-1 block text-xs text-faint">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-6 py-10 text-center"><Bell className="mx-auto size-6 text-faint" /><p className="mt-3 text-sm text-muted">Nothing new yet. Save a search or follow a listing and we will let you know here.</p></div>
          )}
          <a href="/account/#alerts" className="flex items-center justify-center gap-1.5 border-t border-rule px-4 py-2.5 text-xs font-medium text-muted hover:bg-paper hover:text-ink"><Settings className="size-3.5" /> Alert settings</a>
        </div>
      ) : null}
    </div>
  );
}
