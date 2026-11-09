/* The Topaz Pages (publishing services directory) data model. The data file is built by
   tools/topaz-directory/build_site_data.py and loaded from /topaz-pages/data/directory.json. Rows are compact arrays,
   in the order the file's "fields" list gives. Until the first build is published the file is missing,
   and the page says the directory is still being built. */
import { fold, placeLabel } from "@/lib/directory";

export const TOPAZ_NAME = "The Topaz Pages";
export const TOPAZ_SHORT = "Topaz Pages";
export const TOPAZ_DATA_URL = "/topaz-pages/data/directory.json";
export const TOPAZ_EMAIL = "amongtheletters@gmail.com";

export type TopazRaw = {
  v: number; built: string; count: number; fields: string[];
  categories: string[]; category_keys: string[]; services: string[][]; styles: string[]; audiences: string[];
  memberships: string[]; works_with: string[]; submissions: string[]; business_models: string[]; pricing: string[];
  formats: string[]; review_sources: string[]; rows: unknown[][];
};

export type Service = {
  i: number; name: string; url: string; domain: string; cat: number; sv: number[]; st: number[]; au: number[];
  ww: number; sb: number; rp: boolean; bm: number; m: number[]; pr: number; fmt: number; country: string; prov: string;
  remote: boolean; langs: string[]; kid: boolean; desc: string; reviews: string; rs: number; alli: string; checked: boolean;
  trust: number; caution: boolean; hay: string; rank: number;
};

const arr = (v: unknown) => (Array.isArray(v) ? v.map(Number) : []);
export function decodeTopaz(d: TopazRaw): { items: Service[]; meta: TopazRaw } {
  const ix = Object.fromEntries(d.fields.map((f, i) => [f, i]));
  const items = d.rows.map((r, i): Service => {
    const g = (k: string) => r[ix[k]];
    const s: Service = {
      i, name: String(g("n") ?? ""), url: String(g("u") ?? ""), domain: String(g("d") ?? ""), cat: Number(g("c") ?? 0),
      sv: arr(g("sv")), st: arr(g("st")), au: arr(g("au")), ww: Number(g("ww") ?? 0), sb: Number(g("sb") ?? 0), rp: !!g("rp"),
      bm: Number(g("bm") ?? 0), m: arr(g("m")), pr: Number(g("pr") ?? 0), fmt: Number(g("f") ?? 0), country: String(g("r") || ""),
      prov: String(g("p") || ""), remote: !!g("rm"), langs: Array.isArray(g("l")) ? (g("l") as string[]) : [], kid: !!g("kid"),
      desc: String(g("s") || ""), reviews: String(g("rv") || ""), rs: Number(g("rs") ?? 0), alli: String(g("al") || ""),
      checked: !!g("k"), trust: Number(g("t") ?? 0), caution: !!g("w"), hay: "", rank: 0,
    };
    const svc = s.sv.map((x) => d.services[s.cat]?.[x]).filter(Boolean).join(" ");
    const aud = s.au.map((x) => d.audiences[x]).join(" ");
    const mem = s.m.map((x) => d.memberships[x]).join(" ");
    s.hay = fold([s.name, s.domain, s.desc, d.categories[s.cat], svc, aud, mem, placeLabel(s)].join(" "));
    s.rank = (s.country === "CA" ? 6 : 0) + s.trust * 2 + (s.desc ? 2 : 0) - (s.caution ? 20 : 0);
    return s;
  });
  return { items, meta: d };
}

export const TRUST_LEVELS = [
  { key: "strong", label: "Strong public signals", min: 4 },
  { key: "some", label: "Some public signals", min: 2 },
  { key: "few", label: "Few public signals", min: 0 },
] as const;
export type TrustKey = (typeof TRUST_LEVELS)[number]["key"];
export const trustLevel = (s: Pick<Service, "trust" | "caution">): TrustKey | "caution" =>
  s.caution ? "caution" : s.trust >= 4 ? "strong" : s.trust >= 2 ? "some" : "few";

/** The public signals behind a trust score, in plain words. Mirrors trust() in build_site_data.py. */
export function trustSignals(s: Service, meta: TopazRaw): string[] {
  if (s.caution) return ["Listed with an ALLi Watchdog advisory or caution. Read the advisory before you go further."];
  const out: string[] = [];
  if (s.checked) out.push("We could read the site itself");
  if (s.m.length) out.push(`Member of ${s.m.map((x) => meta.memberships[x]).filter(Boolean).slice(0, 2).join(" and ")}`);
  if (s.rs >= 2) out.push(`Has a public review page (${meta.review_sources[s.rs]})`);
  if (/excellent|recommended/i.test(s.alli)) out.push(`ALLi rating of ${s.alli}`);
  if (!out.length) out.push("We found few public signals yet, so check carefully");
  return out;
}

export type TopazFilters = {
  q: string; cat: number; ww: number; open: boolean; remote: boolean; canada: boolean; member: boolean;
  aud: number[]; trust: TrustKey[]; priced: boolean;
};
export const TOPAZ_EMPTY: TopazFilters = { q: "", cat: -1, ww: 0, open: false, remote: false, canada: false, member: false, aud: [], trust: [], priced: false };

export function topazFromUrl(): TopazFilters {
  const p = new URLSearchParams(window.location.search);
  const n = (k: string, d: number) => { const v = p.get(k); return v !== null && /^\d+$/.test(v) ? Number(v) : d; };
  const list = (k: string) => (p.get(k) || "").split(",").filter(Boolean);
  return {
    q: p.get("q") || "", cat: n("cat", -1), ww: n("works", 0), open: p.get("open") === "1", remote: p.get("remote") === "1",
    canada: p.get("canada") === "1", member: p.get("member") === "1", aud: list("for").map(Number).filter((x) => x >= 0),
    trust: list("trust").filter((t): t is TrustKey => TRUST_LEVELS.some((x) => x.key === t)), priced: p.get("priced") === "1",
  };
}
export function topazToUrl(f: TopazFilters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.cat >= 0) p.set("cat", String(f.cat));
  if (f.ww) p.set("works", String(f.ww));
  if (f.open) p.set("open", "1");
  if (f.remote) p.set("remote", "1");
  if (f.canada) p.set("canada", "1");
  if (f.member) p.set("member", "1");
  if (f.aud.length) p.set("for", f.aud.join(","));
  if (f.trust.length) p.set("trust", f.trust.join(","));
  if (f.priced) p.set("priced", "1");
  const qs = p.toString();
  const next = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, "", next);
}

/* Works with "both" counts for either choice. */
export function topazMatches(s: Service, f: TopazFilters, tokens: string[], skip: "cat" | "none" = "none") {
  if (skip !== "cat" && f.cat >= 0 && s.cat !== f.cat) return false;
  if (f.ww && s.ww !== f.ww && s.ww !== 3) return false;
  if (f.open && s.sb !== 1) return false;
  if (f.remote && !s.remote) return false;
  if (f.canada && s.country !== "CA") return false;
  if (f.member && !s.m.length) return false;
  if (f.aud.length && !f.aud.some((a) => s.au.includes(a))) return false;
  if (f.trust.length) { const t = trustLevel(s); if (t === "caution" || !f.trust.includes(t)) return false; }
  if (f.priced && s.pr !== 1) return false;
  for (const t of tokens) if (!s.hay.includes(t)) return false;
  return true;
}

export const topazMail = (subject: string, body: string) => `mailto:${TOPAZ_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
