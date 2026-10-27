// Supabase Edge Function `alerts`. Runs hourly from pg_cron (migration 20261026000200_schedule.sql).
// Deploy with: supabase functions deploy alerts --no-verify-jwt   (it checks CRON_SECRET itself)
//
// 1. New matches for saved searches        -> notifications (kind new_match)
// 2. Followed listings closing soon        -> notifications (closing_soon, deadline_today)
// 3. Browser push for new on-site notices  (only if VAPID keys are set and the member opted in)
// 4. Email for people who opted in         (instant every run, daily 9 a.m. Toronto, weekly Mondays 9 a.m.)
// 5. The Substack to-do digest to ADMIN_EMAIL, daily at 9 a.m. Toronto when there is something to do
//
// Secrets: CRON_SECRET, BREVO_API_KEY, MAIL_FROM (e.g. alerts@amongtheletters.com), ADMIN_EMAIL, optional REPLY_TO,
//          optional VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:amongtheletters@gmail.com)
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";
import { EMPTY, matches, normalizeAll, type Filters, type Opp } from "../_shared/opportunities.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const SITE = "https://amongtheletters.com";
const env = (k: string) => Deno.env.get(k) ?? "";

const torontoNow = () => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" })
    .formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) % 24, weekday: p.weekday };
};
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

async function sendEmail(to: string, subject: string, html: string) {
  const r = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env("BREVO_API_KEY"), "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: { name: "Among The Letters", email: env("MAIL_FROM") }, replyTo: { email: env("REPLY_TO") || "amongtheletters@gmail.com" }, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!r.ok) throw new Error(`Brevo ${r.status} ${await r.text()}`);
}
const shell = (title: string, inner: string) => `<div style="font-family:Georgia,serif;max-width:560px;margin:auto;color:#1a1612;background:#f7f5f0;padding:28px">
  <p style="font-style:italic;font-size:18px;margin:0 0 18px">Among The Letters</p><h1 style="font-weight:500;font-size:24px;margin:0 0 16px">${esc(title)}</h1>${inner}
  <p style="font-family:Arial,sans-serif;font-size:12px;color:#6f6457;margin-top:28px">You get this because you turned on email alerts. <a href="${SITE}/account/#alerts" style="color:#6e342c">Change alert settings</a>.</p></div>`;

type Notice = { id: number; user_id: string; kind: string; title: string; body: string; link: string; saved_search_id: string | null; onsite: boolean; want_email: boolean; created_at: string; emailed_at: string | null; pushed_at: string | null };

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== env("CRON_SECRET") || !env("CRON_SECRET")) return new Response("forbidden", { status: 403 });
  const now = torontoNow();
  const report: Record<string, number> = {};

  // normalize() applies the upkeep rules, so an annual listing past its deadline only carries an expected month
  // and never a deadline, which keeps closing reminders to real dates only.
  const { data: oppRows } = await db.from("opportunities").select("*").lt("link_fail_count", 2);
  const opps: Opp[] = normalizeAll((oppRows ?? []).map((r) => ({ ...r, deadlineNote: r.deadline_note, recurrence: r.recurrence,
    typicalCloseMonth: r.typical_close_month, paysWriter: r.pays_writer, payRate: r.pay_rate })) as Opp[], now.date);
  const byId = new Map(opps.map((o) => [o.id, o]));
  const { data: recips } = await db.rpc("alert_recipients");
  const members = new Map<string, string>((recips ?? []).map((r: { user_id: string; email: string }) => [r.user_id, r.email]));
  const ids = [...members.keys()];
  if (!ids.length) return Response.json({ ok: true, members: 0 });
  const { data: prefRows } = await db.from("notification_prefs").select("*").in("user_id", ids);
  const prefs = new Map((prefRows ?? []).map((p) => [p.user_id, p]));

  // 1. saved searches
  const { data: searches } = await db.from("saved_searches").select("*").in("user_id", ids);
  const fresh: Partial<Notice>[] = [];
  for (const s of searches ?? []) {
    if (!s.onsite && !s.email) continue;
    const since = (s.last_checked_at ?? s.created_at).slice(0, 10);
    const f: Filters = { ...EMPTY, ...s.filters, savedOnly: false };
    for (const o of opps) if (o.added >= since && matches(o, f)) fresh.push({
      user_id: s.user_id, kind: "new_match", title: `New match for ${s.name}`, body: `${o.org}, ${o.title}.${o.deadline ? ` Deadline ${o.deadline}.` : ""}`,
      link: `/opportunities/?o=${encodeURIComponent(o.id)}&s=${s.id}`, opportunity_id: o.id, saved_search_id: s.id, onsite: s.onsite, want_email: s.email,
    } as Partial<Notice>);
  }
  // 2. followed listings closing soon
  const { data: follows } = await db.from("follows").select("user_id,opportunity_id").in("user_id", ids);
  for (const fl of follows ?? []) {
    const o = byId.get(fl.opportunity_id); if (!o?.deadline || o.expected) continue;
    const left = daysBetween(now.date, o.deadline), lead = prefs.get(fl.user_id)?.closing_soon_days ?? 7;
    if (left < 0 || left > lead) continue;
    fresh.push({ user_id: fl.user_id, kind: left === 0 ? "deadline_today" : "closing_soon", title: left === 0 ? "Closes today" : `Closing in ${left} ${left === 1 ? "day" : "days"}`,
      body: `${o.org}, ${o.title}.${o.deadlineNote ? ` ${o.deadlineNote}.` : ""}`, link: `/opportunities/?o=${encodeURIComponent(o.id)}`, opportunity_id: o.id, onsite: true, want_email: true } as Partial<Notice>);
  }
  if (fresh.length) {
    const { data: ins } = await db.from("notifications").upsert(fresh, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }).select("id");
    report.created = ins?.length ?? 0;
  }
  await db.from("saved_searches").update({ last_checked_at: new Date().toISOString() }).in("user_id", ids);

  // 3. browser push
  if (env("VAPID_PRIVATE_KEY")) {
    webpush.setVapidDetails(env("VAPID_SUBJECT") || "mailto:amongtheletters@gmail.com", env("VAPID_PUBLIC_KEY"), env("VAPID_PRIVATE_KEY"));
    const pushUsers = ids.filter((u) => prefs.get(u)?.push_enabled);
    if (pushUsers.length) {
      const { data: pend } = await db.from("notifications").select("*").in("user_id", pushUsers).eq("onsite", true).is("pushed_at", null).is("read_at", null).gte("created_at", new Date(Date.now() - 86400000).toISOString());
      const { data: subs } = await db.from("push_subscriptions").select("*").in("user_id", pushUsers);
      for (const n of (pend ?? []) as Notice[]) {
        for (const s of (subs ?? []).filter((x) => x.user_id === n.user_id)) {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ title: n.title, body: n.body, link: n.link, tag: `atl-${n.id}` })); }
          catch (e) { if ((e as { statusCode?: number }).statusCode === 410 || (e as { statusCode?: number }).statusCode === 404) await db.from("push_subscriptions").delete().eq("id", s.id); }
        }
        await db.from("notifications").update({ pushed_at: new Date().toISOString() }).eq("id", n.id);
      }
    }
  }

  // 4. email, opt-in only
  const digestHour = now.hour === 9;
  const emailUsers = ids.filter((u) => prefs.get(u)?.email_enabled);
  if (emailUsers.length && env("BREVO_API_KEY")) {
    const { data: pend } = await db.from("notifications").select("*").in("user_id", emailUsers).eq("want_email", true).is("emailed_at", null);
    const freqBySearch = new Map((searches ?? []).map((s) => [s.id, s.frequency as string]));
    const due = ((pend ?? []) as Notice[]).filter((n) => {
      const fq = n.saved_search_id ? freqBySearch.get(n.saved_search_id) ?? "daily" : "instant"; // closing reminders go out promptly
      return fq === "instant" || (fq === "daily" && digestHour) || (fq === "weekly" && digestHour && now.weekday === "Mon");
    });
    const perUser = new Map<string, Notice[]>();
    for (const n of due) perUser.set(n.user_id, [...(perUser.get(n.user_id) ?? []), n]);
    let sent = 0;
    for (const [uid, list] of perUser) {
      const items = list.map((n) => `<li style="margin:0 0 14px"><a href="${SITE}${n.link}" style="color:#6e342c;font-weight:600">${esc(n.title)}</a><br><span style="font-family:Arial,sans-serif;font-size:14px;color:#5f584c">${esc(n.body)}</span></li>`).join("");
      try {
        await sendEmail(members.get(uid)!, list.length === 1 ? list[0].title : `${list.length} new alerts from Among The Letters`, shell(list.length === 1 ? list[0].title : "Your alerts", `<ul style="padding-left:18px">${items}</ul>`));
        await db.from("notifications").update({ emailed_at: new Date().toISOString() }).in("id", list.map((n) => n.id));
        sent++;
      } catch (e) { console.error(e); }
    }
    report.emails = sent;
  }

  // 5. Substack to-do digest
  if (digestHour && env("ADMIN_EMAIL") && env("BREVO_API_KEY")) {
    const { data: todo } = await db.from("substack_queue").select("*").is("done_at", null).order("created_at");
    if (todo?.length) {
      const rows = todo.map((t) => `<li><strong>${t.action === "comp" ? "Comp" : t.action === "extend" ? "Extend" : "Remove"}</strong> ${esc(t.email)}${t.action === "remove" ? "" : t.comp_until ? `, 1 year to ${t.comp_until}` : ", forever"}</li>`).join("");
      await sendEmail(env("ADMIN_EMAIL"), `Substack to-do, ${todo.length} ${todo.length === 1 ? "item" : "items"}`, shell("Substack to-do", `<ul>${rows}</ul><p><a href="${SITE}/account/" style="color:#6e342c">Mark them done on your account page</a></p>`))
        .catch((e) => console.error(e));
      report.todo = todo.length;
    }
  }

  return Response.json({ ok: true, members: ids.length, ...report });
});
