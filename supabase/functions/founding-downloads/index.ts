// Supabase Edge Function `founding-downloads`. Deploy with: supabase functions deploy founding-downloads
// (JWT verified by Supabase). Returns short-lived signed links to the guide files for active lifetime
// (founding) members only. The `founding-downloads` bucket is private and has no storage policies,
// so only this function, with the service role, can read it.
import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "founding-downloads";
const TTL = 600; // seconds
// id, path in the bucket, the filename the browser saves
const FILES = [
  ["opportunity-map", "opportunity-map.pdf", "The Opportunity Map - Among The Letters.pdf"],
  ["submission-desk", "submission-desk.pdf", "The Submission Desk - Among The Letters.pdf"],
  ["tracker-xlsx", "submission-tracker.xlsx", "Submission Tracker - Among The Letters.xlsx"],
  ["tracker-csv", "submission-tracker.csv", "Submission Tracker - Among The Letters.csv"],
] as const;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST" && req.method !== "GET") return json({ error: "method not allowed" }, 405);
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: u } = token ? await db.auth.getUser(token) : { data: null };
  if (!u?.user) return json({ error: "sign in first" }, 401);

  // Same rule as the lifetime branch of public.member_row_active().
  const { data: m } = await db.from("members").select("plan,status").eq("user_id", u.user.id).maybeSingle();
  if (!m || m.plan !== "lifetime" || m.status !== "active") return json({ error: "founding members only" }, 403);

  const files: { id: string; url: string }[] = [];
  for (const [id, path, name] of FILES) {
    const { data, error } = await db.storage.from(BUCKET).createSignedUrl(path, TTL, { download: name });
    if (error || !data) { console.error(path, error); return json({ error: "files unavailable" }, 500); }
    files.push({ id, url: data.signedUrl });
  }
  return json({ files, expiresIn: TTL });
});
