// Supabase Edge Function `calendar-feed`. Deploy with: supabase functions deploy calendar-feed --no-verify-jwt
// GET /functions/v1/calendar-feed?token=<calendar_token>  ->  an .ics of the listings a member follows.
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
const ymd = (d: string) => d.replace(/-/g, "");
const nextDay = (d: string) => new Date(Date.parse(d) + 86400000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  if (!/^[a-f0-9]{36}$/.test(token)) return new Response("not found", { status: 404 });
  const { data: pref } = await db.from("notification_prefs").select("user_id").eq("calendar_token", token).maybeSingle();
  if (!pref) return new Response("not found", { status: 404 });
  const { data: recips } = await db.rpc("alert_recipients");
  if (!(recips ?? []).some((r: { user_id: string }) => r.user_id === pref.user_id)) return new Response("membership ended", { status: 403 });
  const { data: rows } = await db.from("follows").select("opportunities(id,title,org,deadline,deadline_note,url,summary)").eq("user_id", pref.user_id);
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const events = (rows ?? []).map((r) => r.opportunities as unknown as { id: string; title: string; org: string; deadline: string | null; deadline_note: string | null; url: string; summary: string })
    .filter((o) => o?.deadline).map((o) => [
      "BEGIN:VEVENT", `UID:atl-opp-${o.id}@amongtheletters.com`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${ymd(o.deadline!)}`, `DTEND;VALUE=DATE:${ymd(nextDay(o.deadline!))}`,
      `SUMMARY:${esc(`Deadline, ${o.org} ${o.title}`)}`, `DESCRIPTION:${esc(`${o.summary} ${o.deadline_note ?? ""} ${o.url}`)}`, `URL:${o.url}`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:${esc(`One week left, ${o.title}`)}`, "END:VALARM", "END:VEVENT"].join("\r\n"));
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Among The Letters//Deadlines//EN", "X-WR-CALNAME:Among The Letters deadlines", "REFRESH-INTERVAL;VALUE=DURATION:PT6H", ...events, "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "content-type": "text/calendar; charset=utf-8", "cache-control": "private, max-age=3600" } });
});
