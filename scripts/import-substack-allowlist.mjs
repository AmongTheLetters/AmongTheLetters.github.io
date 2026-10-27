// Refreshes the paid-subscriber allowlist from Substack's subscriber export (Subscribers, Export, CSV).
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-substack-allowlist.mjs ~/Downloads/subscribers.csv [--dry-run]
// Paying subscribers (paid, founding, gift) are added or kept active. Comps are skipped, because comps are the
// website's own members. Free readers and the author account are skipped. Anyone on the list who is no longer
// paying, or whose paid access has expired, is switched off, not deleted.
// --dry-run reads the allowlist and prints the counts without changing anything.
// Only counts are printed, never addresses. The export holds personal data, so keep it out of this repo and
// delete it after the import.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const dry = args.includes("--dry-run"), file = args.find((a) => !a.startsWith("--"));
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !url || !key) { console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-substack-allowlist.mjs export.csv [--dry-run]"); process.exit(1); }

function parseCsv(text) {
  const out = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((x) => x.trim()));
}
const [head, ...rows] = parseCsv(readFileSync(file, "utf8").replace(/^\uFEFF/, ""));
const names = head.map((h) => h.trim().toLowerCase());
// Substack's export headers (October 2026): Email, Name, Type (Free, Comp, Paid, Founding, Gift, Author),
// Expiration date, Subscription source (paid), Stripe plan, and about 50 activity columns.
const col = (...want) => { for (const w of want) { const i = names.indexOf(w); if (i >= 0) return i; } return -1; };
const ei = col("email", "e-mail", "email address"), ti = col("type", "subscription type", "subscription_type");
const xi = col("expiration date"), si = col("subscription source (paid)");
if (ei < 0 || ti < 0) { console.error("Could not find the Email and Type columns. Headers were", head); process.exit(1); }

const now = Date.now(), counts = { paid: 0, founding: 0, gift: 0, comp: 0, free: 0, author: 0, expired: 0, other: 0 };
const paying = new Map();
for (const r of rows) {
  const email = (r[ei] || "").trim().toLowerCase(), type = (r[ti] || "").trim().toLowerCase();
  if (!email.includes("@")) continue;
  const source = si >= 0 ? (r[si] || "").trim().toLowerCase() : "";
  const exp = xi >= 0 ? Date.parse(r[xi] || "") : NaN;
  if (/comp/.test(type) || source === "comp") { counts.comp++; continue; }
  if (/free/.test(type)) { counts.free++; continue; }
  if (/author|admin|contributor/.test(type)) { counts.author++; continue; }
  const kind = /founding/.test(type) ? "founding" : /gift/.test(type) ? "gift" : /paid|annual|monthly|yearly/.test(type) ? "paid" : null;
  if (!kind) { counts.other++; continue; }
  if (!Number.isNaN(exp) && exp < now) { counts.expired++; continue; }
  counts[kind]++; paying.set(email, type);
}

const today = new Date().toISOString().slice(0, 10);
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
let r = await fetch(`${url}/rest/v1/substack_allowlist?select=email&active=eq.true`, { headers: h });
if (!r.ok) { console.error("reading the allowlist failed", r.status); process.exit(1); }
const lapsing = (await r.json()).filter((x) => !paying.has(x.email.toLowerCase())).length;

const summary = `paid ${counts.paid}, founding ${counts.founding}, gift ${counts.gift}, comp skipped ${counts.comp}, free skipped ${counts.free}, author skipped ${counts.author}, expired skipped ${counts.expired}, unknown type skipped ${counts.other}`;
if (dry) { console.log(`Dry run, nothing changed. ${summary}. Would switch off ${lapsing} who no longer pay.`); process.exit(0); }

if (paying.size) {
  const body = [...paying].map(([email, type]) => ({ email, subscription_type: type, active: true, last_seen: today }));
  r = await fetch(`${url}/rest/v1/substack_allowlist?on_conflict=email`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
  if (!r.ok) { console.error("upsert failed", r.status); process.exit(1); }
}
r = await fetch(`${url}/rest/v1/substack_allowlist?active=eq.true&last_seen=lt.${today}`, { method: "PATCH", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify({ active: false }) });
if (!r.ok) { console.error("switching off lapsed subscribers failed", r.status); process.exit(1); }
const off = (await r.json()).length;
console.log(`Imported. ${summary}. Allowlist has ${paying.size} active. Switched off ${off} who no longer pay.`);
