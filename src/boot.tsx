/* One start-up for every page. The page's own HTML file names which page it is, and the router swaps pages
   in place after that, so the reading music (and anything else kept in memory) carries on between pages. */
import { StrictMode, type ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { pageFor, setLoaders, startRouter, useRoute, type PageKey } from "@/lib/router";
import { resumeAfterReload } from "@/lib/music";
import "./styles.css";

const cache: Partial<Record<PageKey, ComponentType>> = {};
const lazy = (k: PageKey, f: () => Promise<ComponentType>) => async () => { if (!cache[k]) cache[k] = await f(); return cache[k]; };

setLoaders({
  home: lazy("home", () => import("./App").then((m) => m.App)),
  archive: lazy("archive", () => import("./ArchiveApp").then((m) => m.ArchiveApp)),
  shop: lazy("shop", () => import("./ShopApp").then((m) => m.ShopApp)),
  resources: lazy("resources", () => import("./ResourcesApp").then((m) => m.ResourcesApp)),
  glossary: lazy("glossary", () => import("./GlossaryApp").then((m) => m.GlossaryApp)),
  calendar: lazy("calendar", () => import("./CalendarApp").then((m) => m.CalendarApp)),
  opportunities: lazy("opportunities", () => import("./OpportunitiesApp").then((m) => m.OpportunitiesApp)),
  jadePages: lazy("jadePages", () => import("./DirectoryApp").then((m) => m.DirectoryApp)),
  topazPages: lazy("topazPages", () => import("./TopazApp").then((m) => m.TopazApp)),
  account: lazy("account", () => import("./AccountApp").then((m) => m.AccountApp)),
  membership: lazy("membership", () => import("./MembershipApp").then((m) => m.MembershipApp)),
});

function Site({ first: First }: { first: ComponentType }) {
  const r = useRoute();
  const Page = (r.key && cache[r.key]) || First;
  /* key forces a clean mount of each page, as a fresh load would. */
  return <Page key={r.key ?? "first"} />;
}

/** Draw this page's component, then hand later link clicks to the router. */
export function boot(Page: ComponentType) {
  const key = pageFor(window.location.pathname);
  if (key) cache[key] = Page;
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Site first={Page} />
    </StrictMode>,
  );
  startRouter();
  resumeAfterReload();
}
