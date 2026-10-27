// Copies the listing types and filter matcher into the Edge Functions folder so the site and the alerts agree.
import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync("src/lib/opportunities.ts", "utf8");
const body = src.slice(src.indexOf("export type OppType"), src.indexOf("/* ---------- calendar export"));
writeFileSync("supabase/functions/_shared/opportunities.ts", "// Copied from src/lib/opportunities.ts by scripts/sync-shared.mjs. Edit the original, then run `node scripts/sync-shared.mjs`.\n" + body);
console.log("synced");
