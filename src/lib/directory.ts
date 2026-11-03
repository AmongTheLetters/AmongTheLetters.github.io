/* The Jade Pages (reading directory) data model. The data file is built by tools/reading-directory/build_site_data.py and
   loaded once, after the page has drawn, from /jade-pages/data/directory.json. Rows are compact arrays. */

export type RawData = {
  v: number; built: string; count: number; fields: string[];
  categories: string[]; access: string[]; formats: string[]; genres: string[];
  rows: (string | number)[][];
};

export type Site = {
  i: number; name: string; url: string; domain: string; cat: number; acc: number; fmt: number; gen: number;
  desc: string; lang: string; country: string; prov: string; checked: boolean; subs: boolean; evidence: string;
  hay: string; rank: number;
};

/* The section's name lives here only. Change these and the page, header link and copy follow.
   The page title and meta text are in scripts/build-seo.py (PAGES, jade-pages/index.html). */
export const DIRECTORY_NAME = "The Jade Pages";
export const DIRECTORY_SHORT = "Jade Pages";
export const DATA_URL = "/jade-pages/data/directory.json";
export const SUGGEST_EMAIL = "amongtheletters@gmail.com";

export const ACCESS_LABEL: Record<string, string> = { free: "Free", paid: "Paid", mixed: "Free and paid", unconfirmed: "Access not yet confirmed" };
export const ACCESS_HINT: Record<string, string> = {
  free: "Free to read", paid: "Sells books, issues or subscriptions", mixed: "Some free reading, some paid", unconfirmed: "We are still confirming whether this site is free or paid",
};
export const FORMAT_LABEL: Record<string, string> = { print: "Print", ebook: "Ebook", audiobook: "Audiobook", web: "Read online", podcast: "Podcast" };
export const FILTER_FORMATS = ["print", "ebook", "audiobook", "web"] as const;

export const PROVINCES: Record<string, string> = {
  AB: "Alberta", BC: "British Columbia", MB: "Manitoba", NB: "New Brunswick", NL: "Newfoundland and Labrador", NS: "Nova Scotia",
  NT: "Northwest Territories", NU: "Nunavut", ON: "Ontario", PE: "Prince Edward Island", QC: "Quebec", SK: "Saskatchewan", YT: "Yukon",
};

const EUROPE = new Set("AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FO FR GR HR HU IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA VA XK".split(" "));
export const REGIONS = [
  ["all", "Anywhere"], ["CA", "Canada"], ["US", "United States"], ["UKIE", "UK and Ireland"], ["ANZ", "Australia and New Zealand"],
  ["EU", "Europe"], ["WORLD", "Rest of the world"], ["NONE", "Region not yet known"],
] as const;
export type Region = (typeof REGIONS)[number][0];
export function regionOf(c: string): Region {
  if (!c) return "NONE";
  if (c === "CA" || c === "US") return c;
  if (c === "GB" || c === "IE") return "UKIE";
  if (c === "AU" || c === "NZ") return "ANZ";
  if (EUROPE.has(c)) return "EU";
  return "WORLD";
}

export const LANGS = [["all", "Any language"], ["en", "English"], ["fr", "French"], ["other", "Other languages"]] as const;
export type Lang = (typeof LANGS)[number][0];

let regionNames: Intl.DisplayNames | null = null;
let langNames: Intl.DisplayNames | null = null;
try { regionNames = new Intl.DisplayNames(["en-CA"], { type: "region" }); langNames = new Intl.DisplayNames(["en-CA"], { type: "language" }); } catch { /* old browser */ }
export const countryName = (c: string) => { if (!c) return ""; if (c === "GB") return "United Kingdom"; try { return regionNames?.of(c) || c; } catch { return c; } };
export const languageName = (l: string) => { if (!l) return ""; try { return langNames?.of(l) || l; } catch { return l; } };
export function placeLabel(s: Pick<Site, "country" | "prov">) {
  if (s.country === "CA" && s.prov) return `${PROVINCES[s.prov] ?? s.prov}, Canada`;
  return countryName(s.country);
}

/** Lowercase and drop accents, so "editions" finds "Éditions". */
export const fold = (s: string) => s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase();

export function decode(d: RawData): { sites: Site[]; meta: RawData } {
  const ix = Object.fromEntries(d.fields.map((f, i) => [f, i]));
  const sites = d.rows.map((r, i): Site => {
    const g = (k: string) => r[ix[k]];
    const s = {
      i, name: String(g("n")), url: String(g("u")), domain: String(g("d")), cat: Number(g("c")), acc: Number(g("a")),
      fmt: Number(g("f")), gen: Number(g("g")), desc: String(g("s") || ""), lang: String(g("l") || ""), country: String(g("r") || ""),
      prov: String(g("p") || ""), checked: !!g("k"), subs: !!g("w"), evidence: String(g("e") || ""), hay: "", rank: 0,
    };
    const genres = d.genres.filter((_, b) => (s.gen >> b) & 1).join(" ");
    s.hay = fold([s.name, s.domain, s.desc, d.categories[s.cat], placeLabel(s), s.prov, genres, languageName(s.lang)].join(" "));
    /* Suggested order. Canadian sites first, then sites with a description we read ourselves, then the rest. */
    s.rank = (s.country === "CA" ? 8 : 0) + (s.desc ? 4 : 0) + (s.checked ? 2 : 0) + (s.lang === "en" || s.lang === "fr" ? 1 : 0) + (d.access[s.acc] !== "unconfirmed" ? 1 : 0);
    return s;
  });
  setGenreMasks(d.genres);
  return { sites, meta: d };
}

/* Genre groups shown as filters. Near-duplicate labels from the data merge into one group (flash fiction counts as fiction).
   Groups below MAIN_GENRE_MIN sites sit under "More genres". */
export const GENRE_GROUPS: { key: string; label: string; members: string[] }[] = [
  { key: "fiction", label: "Fiction", members: ["fiction", "flash fiction"] },
  { key: "poetry", label: "Poetry", members: ["poetry"] },
  { key: "nonfiction", label: "Nonfiction & Essays", members: ["nonfiction & essays"] },
  { key: "literary", label: "Literary", members: ["literary"] },
  { key: "comics", label: "Comics", members: ["comics"] },
  { key: "mystery", label: "Mystery & Crime", members: ["mystery & crime"] },
  { key: "translation", label: "Translation", members: ["translation"] },
  { key: "scifi", label: "Science Fiction", members: ["science fiction"] },
  { key: "fantasy", label: "Fantasy", members: ["fantasy"] },
  { key: "horror", label: "Horror", members: ["horror"] },
  { key: "kids", label: "Children & YA", members: ["children & YA"] },
  { key: "drama", label: "Drama", members: ["drama"] },
  { key: "classics", label: "Classics", members: ["classics"] },
  { key: "romance", label: "Romance", members: ["romance"] },
];
export const MAIN_GENRE_MIN = 200;
/** Bitmask of the data genres in each group, worked out once the data has loaded. */
export function genreMasks(genres: string[]) {
  return Object.fromEntries(GENRE_GROUPS.map((g) => [g.key, g.members.reduce((m, name) => { const b = genres.indexOf(name); return b >= 0 ? m | (1 << b) : m; }, 0)]));
}
let MASKS: Record<string, number> = {};
export const setGenreMasks = (genres: string[]) => { MASKS = genreMasks(genres); };
export const inGenre = (s: Pick<Site, "gen">, key: string) => (s.gen & (MASKS[key] ?? 0)) !== 0;

export type SortKey = "suggested" | "az" | "za";
export type Filters = {
  q: string; cat: number; acc: number[]; gen: string[]; fmt: string[]; region: Region; prov: string; lang: Lang; subs: boolean; sort: SortKey;
};
export const EMPTY: Filters = { q: "", cat: -1, acc: [], gen: [], fmt: [], region: "all", prov: "", lang: "all", subs: false, sort: "suggested" };

/** Filters live in the address bar, so any view can be bookmarked or shared. */
export function filtersFromUrl(): Filters {
  const p = new URLSearchParams(window.location.search);
  const num = (k: string, d: number) => { const v = p.get(k); return v !== null && /^\d+$/.test(v) ? Number(v) : d; };
  const list = (k: string) => (p.get(k) || "").split(",").filter(Boolean);
  const region = (p.get("region") || "all") as Region;
  const lang = (p.get("lang") || "all") as Lang;
  const sort = (p.get("sort") || "suggested") as SortKey;
  return {
    q: p.get("q") || "", cat: num("cat", -1), acc: list("access").map(Number).filter((n) => n >= 0 && n < 4),
    gen: list("genre").filter((g) => GENRE_GROUPS.some((x) => x.key === g)), fmt: list("format"),
    region: REGIONS.some(([r]) => r === region) ? region : "all", prov: p.get("prov") || "",
    lang: LANGS.some(([l]) => l === lang) ? lang : "all", subs: p.get("subs") === "1", sort: ["suggested", "az", "za"].includes(sort) ? sort : "suggested",
  };
}
export function filtersToUrl(f: Filters) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.cat >= 0) p.set("cat", String(f.cat));
  if (f.acc.length) p.set("access", f.acc.join(","));
  if (f.gen.length) p.set("genre", f.gen.join(","));
  if (f.fmt.length) p.set("format", f.fmt.join(","));
  if (f.region !== "all") p.set("region", f.region);
  if (f.prov) p.set("prov", f.prov);
  if (f.lang !== "all") p.set("lang", f.lang);
  if (f.subs) p.set("subs", "1");
  if (f.sort !== "suggested") p.set("sort", f.sort);
  const qs = p.toString();
  const next = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
  if (next !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, "", next);
}

type Skip = "cat" | "acc" | "region" | "gen" | "none";
/** True when a site passes every filter, optionally ignoring one group (used for the counts beside each chip). */
export function matches(s: Site, f: Filters, tokens: string[], formats: string[], skip: Skip = "none") {
  if (skip !== "cat" && f.cat >= 0 && s.cat !== f.cat) return false;
  if (skip !== "acc" && f.acc.length && !f.acc.includes(s.acc)) return false;
  if (skip !== "region") {
    if (f.region !== "all" && regionOf(s.country) !== f.region) return false;
    if (f.region === "CA" && f.prov && s.prov !== f.prov) return false;
  }
  if (skip !== "gen" && f.gen.length && !f.gen.some((g) => inGenre(s, g))) return false;
  if (f.fmt.length && !f.fmt.every((x) => (s.fmt >> formats.indexOf(x)) & 1)) return false;
  if (f.lang === "en" && s.lang !== "en") return false;
  if (f.lang === "fr" && s.lang !== "fr") return false;
  if (f.lang === "other" && (s.lang === "en" || s.lang === "fr" || !s.lang)) return false;
  if (f.subs && !s.subs) return false;
  for (const t of tokens) if (!s.hay.includes(t)) return false;
  return true;
}

export function relevance(s: Site, tokens: string[]) {
  const n = fold(s.name);
  let score = 0;
  for (const t of tokens) score += n.startsWith(t) ? 6 : n.includes(t) ? 4 : s.domain.includes(t) ? 3 : 1;
  return score;
}

export function suggestHref(subject: string, body: string) {
  return `mailto:${SUGGEST_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
