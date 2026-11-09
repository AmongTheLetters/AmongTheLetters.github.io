/* In-site page changes without a full reload, so the reading music keeps playing as readers move around.
   Each page is still its own static HTML file (search engines, shared links and first visits are unchanged).
   Once the site is running, a click on a link to another of our pages swaps the page in place instead:
   the new page's code loads, its title, description and other head tags are copied from its HTML file,
   and the address bar updates. Anything else (other sites, PDFs, downloads, new tabs, mailto, hash links on
   the same page, modified clicks) is left to the browser. If anything goes wrong, it falls back to a normal load. */
import { useSyncExternalStore } from "react";

export type PageKey = "home" | "archive" | "shop" | "resources" | "glossary" | "calendar" | "opportunities" | "jadePages" | "topazPages" | "account" | "membership";

const PATHS: Record<string, PageKey> = {
  "/": "home", "/index.html": "home",
  "/archive/": "archive", "/shop/": "shop", "/resources/": "resources", "/resources/glossary/": "glossary",
  "/calendar/": "calendar", "/opportunities/": "opportunities", "/jade-pages/": "jadePages", "/topaz-pages/": "topazPages",
  "/account/": "account", "/membership/": "membership",
};

export function pageFor(pathname: string): PageKey | null {
  let p = pathname.replace(/index\.html$/, "");
  if (!p.endsWith("/")) p += "/";
  return PATHS[p] ?? null;
}

type Loc = { key: PageKey | null; href: string };
let loc: Loc = { key: typeof window === "undefined" ? null : pageFor(window.location.pathname), href: typeof window === "undefined" ? "/" : window.location.href };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());
export const useRoute = () => useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => loc, () => loc);

/* Pages register how to load themselves, so the router does not pull every page into every bundle. */
let loaders: Partial<Record<PageKey, () => Promise<unknown>>> = {};
export function setLoaders(l: typeof loaders) { loaders = l; }

let ready = false;      // turned on by boot() after the first page has drawn
let seq = 0;

const HEAD_SEL = 'title, meta[name="description"], meta[name="keywords"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], link[rel="icon"], script[type="application/ld+json"]';

async function swapHead(url: URL) {
  const res = await fetch(url.pathname, { credentials: "same-origin" });
  if (!res.ok) throw new Error(String(res.status));
  const doc = new DOMParser().parseFromString(await res.text(), "text/html");
  document.head.querySelectorAll(HEAD_SEL).forEach((n) => n.remove());
  doc.head.querySelectorAll(HEAD_SEL).forEach((n) => {
    const c = document.importNode(n, true) as Element;
    /* Relative links in the new page's head are relative to its own address, which is not in the bar yet. */
    const h = c.getAttribute("href"); if (h) c.setAttribute("href", new URL(h, url).href);
    document.head.appendChild(c);
  });
  document.title = doc.title || document.title;
}

function afterRender(url: URL, restoreY?: number) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (typeof restoreY === "number") { window.scrollTo(0, restoreY); return; }
    const id = url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
    const target = id ? document.getElementById(id) : null;
    if (target) target.scrollIntoView(); else window.scrollTo(0, 0);
    /* Move focus to the new page for keyboard and screen reader users. */
    const main = document.querySelector<HTMLElement>("main") ?? document.getElementById("root");
    if (main && !target) { if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1"); main.focus({ preventScroll: true }); }
  }));
}

/** Go to a page on this site. Falls back to a normal page load for anything the router does not know. */
export async function navigate(href: string, opts: { replace?: boolean; pop?: boolean; restoreY?: number } = {}) {
  const url = new URL(href, window.location.href);
  const key = url.origin === window.location.origin ? pageFor(url.pathname) : null;
  const load = key ? loaders[key] : undefined;
  if (!ready || !key || !load) { if (!opts.pop) window.location.assign(url.href); else window.location.reload(); return; }
  const my = ++seq;
  try {
    await Promise.all([load(), swapHead(url)]);
  } catch {
    if (!opts.pop) window.location.assign(url.href); else window.location.reload();
    return;
  }
  if (my !== seq) return; // a newer click won
  if (!opts.pop) {
    try { history.replaceState({ ...(history.state || {}), atlY: window.scrollY }, ""); } catch { /* ignore */ }
    if (opts.replace) history.replaceState({ atl: 1 }, "", url.href); else history.pushState({ atl: 1 }, "", url.href);
  }
  document.body.style.overflow = "";   // a closing popup on the old page may have left this set
  loc = { key, href: url.href };
  emit();
  window.dispatchEvent(new Event("atl:navigate"));
  afterRender(url, opts.restoreY);
}

function onClick(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element | null)?.closest?.("a");
  if (!a || !(a instanceof HTMLAnchorElement)) return;
  if (a.hasAttribute("download") || a.dataset.reload !== undefined) return;
  const t = a.getAttribute("target"); if (t && t !== "_self") return;
  const raw = a.getAttribute("href"); if (!raw || raw.startsWith("#")) return;
  const url = new URL(a.href, window.location.href);
  if (url.origin !== window.location.origin || !/^https?:$/.test(url.protocol)) return;
  const key = pageFor(url.pathname); if (!key) return;   // PDFs, images, feeds, 404s and so on load normally
  /* Same page, only the hash or nothing changes: let the browser handle it. */
  if (url.pathname === window.location.pathname && url.search === window.location.search) return;
  e.preventDefault();
  void navigate(url.href);
}

let lastPath = typeof window === "undefined" ? "" : window.location.pathname + window.location.search;
function onPop(e: PopStateEvent) {
  const here = window.location.pathname + window.location.search;
  if (here === lastPath) return; // hash only, the page handles it
  lastPath = here;
  const y = e.state && typeof e.state.atlY === "number" ? e.state.atlY : undefined;
  void navigate(window.location.href, { pop: true, restoreY: y });
}

export function startRouter() {
  if (ready) return;
  ready = true;
  document.addEventListener("click", onClick);
  window.addEventListener("popstate", onPop);
  window.addEventListener("atl:navigate", () => { lastPath = window.location.pathname + window.location.search; });
  /* Pages that set history state themselves (filters, tabs) keep lastPath honest. */
  for (const m of ["pushState", "replaceState"] as const) {
    const orig = history[m].bind(history);
    history[m] = (...args: Parameters<History["pushState"]>) => { orig(...args); lastPath = window.location.pathname + window.location.search; };
  }
}
