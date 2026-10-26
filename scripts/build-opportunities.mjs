// Builds the public files for /opportunities/ from a private source list.
//   OPP_SOURCE=/path/to/opportunities.json OPP_CODE="MONTHLY-CODE" node scripts/build-opportunities.mjs
// The source list never goes into this public repo. Only three generated files are committed.
//   public/opportunities/data/free.json        free entries in full, plus locked stubs (no title, org or link)
//   public/opportunities/data/members.enc.json every entry, AES-256-GCM encrypted with a key from OPP_CODE
//   public/opportunities/feed.xml              RSS of free entries
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const src = process.env.OPP_SOURCE || "/workspace/atl-project/opportunities/opportunities.json";
const code = process.env.OPP_CODE;
if (!code) { console.error("Set OPP_CODE to this month's access code."); process.exit(1); }
const all = JSON.parse(readFileSync(src, "utf8"));
const today = new Date().toISOString().slice(0, 10);
const live = all.filter((o) => !o.deadline || o.deadline >= today);

const stub = (o) => ({ id: o.id, locked: true, type: o.type, region: o.region, genres: o.genres, fee: o.fee,
  deadline: o.deadline ? o.deadline.slice(0, 7) : null, added: o.added });
const free = live.map((o) => (o.tier === "free" ? o : stub(o)));

const ITER = 250000;
const enc = new TextEncoder();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey("raw", enc.encode(code.trim().toUpperCase()), "PBKDF2", false, ["deriveKey"]);
const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(live))));
const b64 = (u) => Buffer.from(u).toString("base64");

const out = "public/opportunities/data";
mkdirSync(out, { recursive: true });
const meta = { built: today, total: live.length, free: live.filter((o) => o.tier === "free").length };
writeFileSync(`${out}/free.json`, JSON.stringify({ ...meta, items: free }));
writeFileSync(`${out}/members.enc.json`, JSON.stringify({ v: 1, kdf: "PBKDF2-SHA256", iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }));

const x = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const items = live.filter((o) => o.tier === "free").sort((a, b) => b.added.localeCompare(a.added)).map((o) => `
    <item><title>${x(`${o.org}, ${o.title}`)}</title><link>${x(o.url)}</link><guid isPermaLink="false">atl-opp-${o.id}</guid>
      <pubDate>${new Date(o.added + "T10:00:00-04:00").toUTCString()}</pubDate><category>${x(o.type)}</category>
      <description>${x(`${o.summary} Deadline ${o.deadline ?? o.deadlineNote ?? "not stated"}.`)}</description></item>`).join("");
writeFileSync("public/opportunities/feed.xml", `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Among The Letters Opportunities (free list)</title><link>https://amongtheletters.com/opportunities/</link>
  <description>Writing contests, residencies, fellowships, grants and paid markets, checked against official pages.</description>${items}
</channel></rss>
`);
console.log(`Built ${live.length} opportunities, ${meta.free} free, ${live.length - meta.free} locked.`);
