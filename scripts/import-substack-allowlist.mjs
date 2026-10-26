// Refreshes the paid-subscriber allowlist from Substack's subscriber export (Subscribers, Export, CSV).
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-substack-allowlist.mjs ~/Downloads/subscribers.csv
// Paying subscribers (paid, founding, gift) are added or kept active. Comps are skipped, because comps are the
// website's own members. Anyone on the list who is no longer paying is switched off, not deleted.
// The export holds personal data, so keep it out of this repo and delete it after the import.
import { readFileSync } from "node:fs";

const [file] = process.argv.slice(2);
const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!file || !url || !key) { console.error("Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-substack-allowlist.mjs export.csv"); process.exit(1); }

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
const [head, ...rows] = parseCsv(readFileSync(file, "utf8"));
const col = (re) => head.findIndex((h) => re.test(h.trim()));
const ei = col(/^e-?mail/i), ti = col(/subscription.?type|^type$|plan|status/i);
if (ei < 0 || ti < 0) { console.error("Could not find the email and subscription type columns. Headers were", head); process.exit(1); }
const paying = new Map();
for (const r of rows) {
  const email = (r[ei] || "").trim().toLowerCase(), type = (r[ti] || "").trim().toLowerCase();
  if (!email.includes("@")) continue;
  if (/comp/.test(type)) continue;
  if (/paid|founding|gift|annual|monthly/.test(type)) paying.set(email, type);
}
const today = new Date().toISOString().slice(0, 10);
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const body = [...paying].map(([email, type]) => ({ email, subscription_type: type, active: true, last_seen: today }));
let r = await fetch(`${url}/rest/v1/substack_allowlist?on_conflict=email`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(body) });
if (!r.ok) { console.error("upsert failed", r.status, await r.text()); process.exit(1); }
r = await fetch(`${url}/rest/v1/substack_allowlist?active=eq.true&last_seen=lt.${today}`, { method: "PATCH", headers: { ...h, Prefer: "return=representation" }, body: JSON.stringify({ active: false }) });
const off = r.ok ? (await r.json()).length : 0;
console.log(`Allowlist now has ${paying.size} paying Substack subscribers. Switched off ${off} who no longer pay.`);
