// Builds the public files for /opportunities/ from the private source list.
//   OPP_SOURCE=/path/to/opportunities.json node scripts/build-opportunities.mjs
// The source list never goes into this public repo. Two generated files are committed.
//   public/opportunities/data/free.json   free entries in full, plus locked stubs (no title, org or link).
//                                         Used when accounts are off and as the RSS source.
//   public/opportunities/feed.xml         RSS of free entries
// OPP_PREVIEW=1 also writes members.enc.json (every entry, encrypted with the published review key) for
// review builds with pretend accounts. That file is gitignored and is never part of production.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

// OPP_FROM_SUPABASE=1 with SUPABASE_URL and SUPABASE_ANON_KEY reads the public free rows and the locked stubs
// straight from the database instead, which is what the scheduled GitHub Action does (no private file needed).
const src = process.env.OPP_SOURCE || "/workspace/atl-project/opportunities/opportunities.json";
const fromDb = process.env.OPP_FROM_SUPABASE === "1";
const preview = process.env.OPP_PREVIEW === "1" && !fromDb;
const code = "PREVIEW-2026";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto" }).format(new Date());
const ym = (s) => s.slice(0, 7);

const camel = (r) => ({ id: r.id, title: r.title, org: r.org, type: r.type, genres: r.genres, region: r.region, location: r.location, eligibility: r.eligibility,
  opens: r.opens, deadline: r.deadline, deadlineNote: r.deadline_note, fee: r.fee, award: r.award, summary: r.summary, url: r.url, verified: r.verified,
  added: r.added, tier: r.tier, recurrence: r.recurrence, typicalOpenMonth: r.typical_open_month, typicalCloseMonth: r.typical_close_month,
  paysWriter: r.pays_writer, payRate: r.pay_rate, feeAmount: r.fee_amount, feeCurrency: r.fee_currency });
async function rest(path) {
  const k = process.env.SUPABASE_ANON_KEY;
  const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: k, Authorization: `Bearer ${k}` } });
  if (!r.ok) throw new Error(`${path} ${r.status} ${await r.text()}`);
  return r.json();
}

// Same upkeep rules as normalize() in src/lib/opportunities.ts. One-time listings past their deadline drop out,
// annual and rolling listings stay and the page works out the expected month.
const past = (o) => !!o.deadline && (o.deadline.length === 10 ? o.deadline < today : o.deadline < ym(today));
const visible = (o) => (o.recurrence ?? "one-time") !== "one-time" || !past(o);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function expected(o) {
  const m = o.typicalCloseMonth ?? (o.deadline ? Number(o.deadline.slice(5, 7)) : null);
  if (!m) return null;
  let y = Number(today.slice(0, 4));
  while (`${y}-${String(m).padStart(2, "0")}` <= ym(today)) y++;
  return `${MONTHS[m - 1]} ${y}`;
}

const stub = (o) => ({ id: o.id, locked: true, type: o.type, region: o.region, genres: o.genres, fee: o.fee,
  deadline: o.deadline ? o.deadline.slice(0, 7) : null, added: o.added, recurrence: o.recurrence ?? "one-time",
  typicalCloseMonth: o.typicalCloseMonth ?? null, paysWriter: !!o.paysWriter });
let live, free;
if (fromDb) {
  const rows = (await rest("opportunities?select=*")).map(camel).filter(visible);
  const stubs = (await rest("opportunity_stubs?select=*")).map((s) => ({ id: s.id, locked: true, type: s.type, region: s.region, genres: s.genres, fee: s.fee,
    deadline: s.deadline_month, added: s.added, recurrence: s.recurrence, typicalCloseMonth: s.typical_close_month, paysWriter: s.pays_writer })).filter(visible);
  live = rows; free = [...rows, ...stubs];
} else {
  live = JSON.parse(readFileSync(src, "utf8")).filter(visible);
  free = live.map((o) => (o.tier === "free" ? o : stub(o)));
}

const ITER = 1000; // the review key is published, so this is obfuscation for preview builds, not protection
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", enc.encode(code.trim().toUpperCase()), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(live))));
const b64 = (u) => Buffer.from(u).toString("base64");

const out = "public/opportunities/data";
mkdirSync(out, { recursive: true });
const meta = { built: today, total: free.length, free: free.filter((o) => !o.locked).length };
writeFileSync(`${out}/free.json`, JSON.stringify({ ...meta, items: free }));
if (preview) writeFileSync(`${out}/members.enc.json`, JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const items = live.filter((o) => o.tier === "free").sort((a, b) => b.added.localeCompare(a.added)).map((o) => `
    <item><title>${x(`${o.org}, ${o.title}`)}</title><link>${x(o.url)}</link><guid isPermaLink="false">atl-opp-${o.id}</guid>
      <pubDate>${new Date(o.added + "T10:00:00-04:00").toUTCString()}</pubDate><category>${x(o.type)}</category>
      <description>${x(`${o.summary} ${past(o) ? (o.recurrence === "rolling" ? "Open on a rolling basis" : `Next deadline expected around ${expected(o)}`) : `Deadline ${o.deadline ?? o.deadlineNote ?? "not stated"}`}.`)}</description></item>`).join("");
writeFileSync("public/opportunities/feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Among The Letters Opportunities (free list)</title><link>https://amongtheletters.com/opportunities/</link>
  <description>Writing contests, residencies, fellowships, grants and paid markets, checked against official pages.</description>${items}
</channel></rss>
`);
console.log(`Built ${meta.total} opportunities, ${meta.free} free, ${meta.total - meta.free} locked.`);
