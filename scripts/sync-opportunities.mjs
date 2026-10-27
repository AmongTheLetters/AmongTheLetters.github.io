// Pushes the private listings file into the Supabase `opportunities` table and removes listings that left it.
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//   OPP_SOURCE=/workspace/atl-project/opportunities/opportunities.json node scripts/sync-opportunities.mjs
// The service role key bypasses row-level security. Keep it in the environment only, never in a file in this repo.
import { readFileSync } from "node:fs";

const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const src = process.env.OPP_SOURCE || "/workspace/atl-project/opportunities/opportunities.json";
if (!url || !key) { console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."); process.exit(1); }
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const rows = JSON.parse(readFileSync(src, "utf8")).map((o) => ({
  id: o.id, title: o.title, org: o.org, type: o.type, genres: o.genres, region: o.region, location: o.location ?? null, eligibility: o.eligibility ?? null,
  opens: o.opens ?? null, deadline: o.deadline ?? null, deadline_note: o.deadlineNote ?? null, fee: o.fee, award: o.award ?? null, summary: o.summary ?? null,
  url: o.url, verified: o.verified, added: o.added, tier: o.tier,
}));
let r = await fetch(`${url}/rest/v1/opportunities?on_conflict=id`, { method: "POST", headers: { ...h, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
if (!r.ok) { console.error("upsert failed", r.status, await r.text()); process.exit(1); }
const keep = rows.map((x) => `"${x.id.replace(/"/g, "")}"`).join(",");
r = await fetch(`${url}/rest/v1/opportunities?id=not.in.(${encodeURIComponent(keep)})`, { method: "DELETE", headers: { ...h, Prefer: "return=representation" } });
const removed = r.ok ? (await r.json()).length : 0;
console.log(`Synced ${rows.length} listings (${rows.filter((x) => x.tier === "free").length} free). Removed ${removed}.`);
