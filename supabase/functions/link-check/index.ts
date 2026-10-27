// Supabase Edge Function `link-check`. Runs monthly from pg_cron (migration 20261027000400_low_maintenance.sql).
// Deploy with: supabase functions deploy link-check --no-verify-jwt   (it checks CRON_SECRET itself)
//
// Opens every listing's official page. A page that loads resets the failure count. A page that is gone
// (404, 410, or a host that no longer answers) adds one failure. Row-level security hides a listing after
// two failed checks in a row, and the next good check brings it back. Blocked or busy answers
// (403, 429, 5xx, timeouts) count as unknown and change nothing, since many sites turn away robots.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const UA = "Mozilla/5.0 (compatible; AmongTheLettersLinkCheck/1.0; +https://amongtheletters.com/opportunities/)";

async function probe(url: string): Promise<"ok" | "dead" | "unknown"> {
  for (const method of ["HEAD", "GET"]) {
    try {
      const r = await fetch(url, { method, redirect: "follow", headers: { "user-agent": UA, accept: "text/html,*/*" }, signal: AbortSignal.timeout(15000) });
      await r.body?.cancel();
      if (r.status < 400) return "ok";
      if (method === "HEAD") continue; // some servers refuse HEAD, try a real visit
      return r.status === 404 || r.status === 410 ? "dead" : "unknown";
    } catch (e) {
      const msg = String(e);
      if (/timed? ?out|abort/i.test(msg)) return "unknown";
      if (method === "GET") return /dns|resolve|refused|certificate|tls/i.test(msg) ? "dead" : "unknown";
    }
  }
  return "unknown";
}

Deno.serve(async (req) => {
  const secret = Deno.env.get("CRON_SECRET") ?? "";
  if (!secret || req.headers.get("x-cron-secret") !== secret) return new Response("forbidden", { status: 403 });
  const { data, error } = await db.from("opportunities").select("id,url,link_fail_count");
  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  const rows = data ?? [];
  const tally = { ok: 0, dead: 0, unknown: 0, hidden: 0 };
  let i = 0;
  async function worker() {
    while (i < rows.length) {
      const row = rows[i++];
      const status = await probe(row.url);
      tally[status]++;
      const fails = status === "ok" ? 0 : status === "dead" ? row.link_fail_count + 1 : row.link_fail_count;
      if (fails >= 2) tally.hidden++;
      await db.from("opportunities").update({ link_status: status === "unknown" && row.link_fail_count === 0 ? "unknown" : status === "unknown" ? "dead" : status,
        link_fail_count: fails, link_checked_at: new Date().toISOString() }).eq("id", row.id);
    }
  }
  await Promise.all(Array.from({ length: 10 }, worker));
  return Response.json({ ok: true, checked: rows.length, ...tally });
});
