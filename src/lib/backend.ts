/*
 * One small API for accounts, membership, listings and alerts.
 *   live     Supabase Auth and Postgres with row-level security (production)
 *   preview  pretend accounts in localStorage, for review builds only (VITE_PREVIEW=1)
 *   off      no accounts configured yet, free listings only
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { CONFIG, MODE, type Plan } from "@/lib/config";
import { EMPTY, TODAY, type Filters, type Item, type Opp, type Stub } from "@/lib/opportunities";

export type Session = { userId: string; email: string; createdAt: string };
export type MemberStatus = "none" | "active" | "past_due" | "canceling" | "expired";
export type Membership = {
  status: MemberStatus; plan?: Plan | null; periodEnd?: string | null; startedAt?: string | null;
  source: "none" | "stripe" | "substack"; substack: "not_started" | "pending" | "added" | "removal_pending" | "removed";
  substackDate?: string | null; isAdmin: boolean;
};
export type Frequency = "instant" | "daily" | "weekly";
export type SavedSearch = { id: string; name: string; filters: Filters; onsite: boolean; email: boolean; frequency: Frequency; createdAt: string };
export type NotificationKind = "new_match" | "closing_soon" | "deadline_today" | "system";
export type Notice = { id: string; kind: NotificationKind; title: string; body: string; link: string; createdAt: string; readAt: string | null };
export type Prefs = { emailEnabled: boolean; closingSoonDays: number; pushEnabled: boolean; calendarToken?: string | null };
export type TodoItem = { id: number; email: string; action: "comp" | "extend" | "remove" | "cancel_subscription"; compUntil: string | null; note?: string | null; createdAt: string };
export type Listings = { items: Item[]; total: number; free: number };

export const isMember = (m: Membership) => m.status === "active" || m.status === "canceling" || m.status === "past_due";
const NO_MEMBERSHIP: Membership = { status: "none", source: "none", substack: "not_started", isAdmin: false };
const DEFAULT_PREFS: Prefs = { emailEnabled: false, closingSoonDays: 7, pushEnabled: false };
const redirect = (path = "/account/") => `${CONFIG.siteUrl}${path}`;

async function freeFile(): Promise<Listings> {
  const d = await (await fetch("/opportunities/data/free.json", { cache: "no-store" })).json();
  return { items: d.items, total: d.total, free: d.free };
}

/* ======================= live (Supabase) ======================= */
let sb: SupabaseClient | null = null;
const db = () => (sb ??= createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true, flowType: "pkce" } }));
const fail = (e: { message: string } | null) => { if (e) throw new Error(e.message); };
const toSession = (u: { id: string; email?: string; created_at: string } | null | undefined): Session | null => u ? { userId: u.id, email: u.email ?? "", createdAt: u.created_at.slice(0, 10) } : null;
type OppRow = { id: string; title: string; org: string; type: Opp["type"]; genres: string[]; region: string; location: string; eligibility: string; opens: string | null; deadline: string | null; deadline_note: string | null; fee: Opp["fee"]; award: string; summary: string; url: string; verified: string; added: string; tier: Opp["tier"] };
const fromRow = (r: OppRow): Opp => ({ ...r, deadlineNote: r.deadline_note });
type NoticeRow = { id: number; kind: NotificationKind; title: string; body: string; link: string; created_at: string; read_at: string | null };
type SearchRow = { id: string; name: string; filters: Filters; onsite: boolean; email: boolean; frequency: Frequency; created_at: string };
const fromSearch = (r: SearchRow): SavedSearch => ({ id: r.id, name: r.name, filters: { ...EMPTY, ...r.filters }, onsite: r.onsite, email: r.email, frequency: r.frequency, createdAt: r.created_at });

const live = {
  async getSession() { const { data } = await db().auth.getSession(); return toSession(data.session?.user); },
  onAuthChange(cb: (event: string, s: Session | null) => void) { const { data } = db().auth.onAuthStateChange((e, s) => cb(e, toSession(s?.user))); return () => data.subscription.unsubscribe(); },
  async signUp(email: string, password: string) { const { data, error } = await db().auth.signUp({ email, password, options: { emailRedirectTo: redirect() } }); fail(error); return { needsConfirm: !data.session }; },
  async signIn(email: string, password: string) { const { error } = await db().auth.signInWithPassword({ email, password }); fail(error); },
  async magicLink(email: string) { const { error } = await db().auth.signInWithOtp({ email, options: { emailRedirectTo: redirect() } }); fail(error); },
  async resetPassword(email: string) { const { error } = await db().auth.resetPasswordForEmail(email, { redirectTo: redirect("/account/?reset=1") }); fail(error); },
  async updatePassword(password: string) { const { error } = await db().auth.updateUser({ password }); fail(error); },
  async google() { const { error } = await db().auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirect() } }); fail(error); },
  async signOut() { await db().auth.signOut(); },
  async getMembership(): Promise<Membership> { const { data, error } = await db().rpc("my_membership"); fail(error); return { ...NO_MEMBERSHIP, ...(data ?? {}) }; },
  async loadListings(member: boolean): Promise<Listings> {
    const { data, error } = await db().from("opportunities").select("*").or(`deadline.is.null,deadline.gte.${TODAY}`); fail(error);
    const open = (data as OppRow[]).map(fromRow);
    let stubs: Stub[] = [];
    if (!member) {
      const r = await db().from("opportunity_stubs").select("*"); fail(r.error);
      stubs = (r.data as { id: string; type: Opp["type"]; region: string; genres: string[]; fee: Opp["fee"]; deadline_month: string | null; added: string }[])
        .map((s) => ({ id: s.id, locked: true, type: s.type, region: s.region, genres: s.genres, fee: s.fee, deadline: s.deadline_month, added: s.added }));
    }
    return { items: [...open, ...stubs], total: open.length + stubs.length, free: open.filter((o) => o.tier === "free").length };
  },
  async listFollows() { const { data } = await db().from("follows").select("opportunity_id"); return (data ?? []).map((r: { opportunity_id: string }) => r.opportunity_id); },
  async follow(id: string, on: boolean) {
    const s = await live.getSession(); if (!s) return;
    const r = on ? await db().from("follows").upsert({ user_id: s.userId, opportunity_id: id }) : await db().from("follows").delete().eq("opportunity_id", id); fail(r.error);
  },
  async listSearches() { const { data, error } = await db().from("saved_searches").select("*").order("created_at"); fail(error); return (data as SearchRow[]).map(fromSearch); },
  async createSearch(name: string, filters: Filters) {
    const s = await live.getSession(); if (!s) throw new Error("Sign in first");
    const { savedOnly: _s, ...f } = filters;
    const { data, error } = await db().from("saved_searches").insert({ user_id: s.userId, name, filters: f }).select().single(); fail(error); return fromSearch(data as SearchRow);
  },
  async updateSearch(id: string, patch: Partial<Pick<SavedSearch, "onsite" | "email" | "frequency" | "name">>) { const { error } = await db().from("saved_searches").update(patch).eq("id", id); fail(error); },
  async deleteSearch(id: string) { const { error } = await db().from("saved_searches").delete().eq("id", id); fail(error); },
  async listNotices(): Promise<Notice[]> {
    const { data, error } = await db().from("notifications").select("id,kind,title,body,link,created_at,read_at").order("created_at", { ascending: false }).limit(30); fail(error);
    return (data as NoticeRow[]).map((n) => ({ id: String(n.id), kind: n.kind, title: n.title, body: n.body, link: n.link, createdAt: n.created_at, readAt: n.read_at }));
  },
  async markRead(ids: string[] | "all") {
    const q = db().from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);
    const { error } = ids === "all" ? await q : await q.in("id", ids.map(Number)); fail(error);
  },
  async getPrefs(): Promise<Prefs> {
    const { data } = await db().from("notification_prefs").select("email_enabled,closing_soon_days,push_enabled,calendar_token").maybeSingle();
    return data ? { emailEnabled: data.email_enabled, closingSoonDays: data.closing_soon_days, pushEnabled: data.push_enabled, calendarToken: data.calendar_token } : DEFAULT_PREFS;
  },
  async setPrefs(p: Prefs) {
    const s = await live.getSession(); if (!s) return;
    // The row is created by a trigger at sign-up. Members can only change these three columns.
    const { error } = await db().from("notification_prefs").update({ email_enabled: p.emailEnabled, closing_soon_days: p.closingSoonDays, push_enabled: p.pushEnabled }).eq("user_id", s.userId); fail(error);
  },
  async savePush(sub: PushSubscriptionJSON | null) {
    const s = await live.getSession(); if (!s) return;
    if (!sub) { await db().from("push_subscriptions").delete().eq("user_id", s.userId); return; }
    const { error } = await db().from("push_subscriptions").upsert({ user_id: s.userId, endpoint: sub.endpoint, p256dh: sub.keys?.p256dh, auth: sub.keys?.auth }, { onConflict: "endpoint" }); fail(error);
  },
  async listTodo(): Promise<TodoItem[]> {
    const { data, error } = await db().rpc("admin_substack_todo"); fail(error);
    return (data ?? []).map((r: { id: number; email: string; action: TodoItem["action"]; comp_until: string | null; note: string | null; created_at: string }) => ({ id: r.id, email: r.email, action: r.action, compUntil: r.comp_until, note: r.note, createdAt: r.created_at }));
  },
  async markTodoDone(id: number) { const { error } = await db().rpc("admin_mark_substack_done", { item_id: id }); fail(error); },
  calendarUrl(token?: string | null) { return token ? `${CONFIG.supabaseUrl.replace(/^https?:/, "webcal:")}/functions/v1/calendar-feed?token=${token}` : ""; },
};

/* ======================= preview (pretend accounts) ======================= */
const K = { session: "atl-mock-session", member: "atl-mock-membership", prefs: "atl-mock-prefs", searches: "atl-mock-searches", follows: "atl-mock-follows", notices: "atl-mock-notices" };
const get = <T,>(k: string, f: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : f; } catch { return f; } };
const put = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const later = (months: number) => { const d = new Date(); d.setMonth(d.getMonth() + months); return d.toISOString().slice(0, 10); };
const wait = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
async function previewMembersFile(): Promise<Opp[]> {
  const pack = await (await fetch("/opportunities/data/members.enc.json", { cache: "no-store" })).json();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode("PREVIEW-2026"), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(pack.salt), iterations: pack.iter, hash: "SHA-256" }, base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(pack.iv) }, key, unb64(pack.ct))));
}
const ago = (h: number) => new Date(Date.now() - h * 3600000).toISOString();
export const PREVIEW_NOTICES: Notice[] = [
  { id: "n1", kind: "new_match", title: "New match for Residency, Closes within 90 days", body: "Ucross, Fall 2027 Residencies. Applications open November 1.", link: "/opportunities/?o=ucross-fall-2027&s=s1", createdAt: ago(2), readAt: null },
  { id: "n2", kind: "closing_soon", title: "Closing in 6 days", body: "CBC Books, 2027 CBC Short Story Prize. Deadline November 1 at 4:59 p.m. ET.", link: "/opportunities/?o=cbc-short-story-2027", createdAt: ago(5), readAt: null },
  { id: "n3", kind: "new_match", title: "New match for Paid market", body: "Clarkesworld Magazine is open for short fiction at 15 cents a word.", link: "/opportunities/?o=clarkesworld-fiction&s=s2", createdAt: ago(26), readAt: null },
  { id: "n4", kind: "closing_soon", title: "Closing in 9 days", body: "Trillium Arts, 2027 Individual Artist Residencies. No application fee.", link: "/opportunities/?o=trillium-residencies-2027", createdAt: ago(50), readAt: ago(30) },
];
export const PREVIEW_SEARCHES: SavedSearch[] = [
  { id: "s1", name: "Residency, Closes within 90 days", filters: { ...EMPTY, type: "Residency", win: "90" }, onsite: true, email: false, frequency: "instant", createdAt: "2026-10-26" },
  { id: "s2", name: "Paid market", filters: { ...EMPTY, type: "Paid market" }, onsite: true, email: true, frequency: "weekly", createdAt: "2026-10-26" },
];

const preview: typeof live = {
  async getSession() { return get<Session | null>(K.session, null); },
  onAuthChange() { return () => undefined; },
  async signUp(email) { await wait(); put(K.session, { userId: crypto.randomUUID(), email: email.trim().toLowerCase(), createdAt: TODAY }); return { needsConfirm: false }; },
  async signIn(email) { await wait(); put(K.session, { userId: "preview-user", email: email.trim().toLowerCase(), createdAt: TODAY }); },
  async magicLink() { await wait(); },
  async resetPassword() { await wait(); },
  async updatePassword() { await wait(); },
  async google() { await wait(); },
  async signOut() { Object.values(K).forEach((k) => localStorage.removeItem(k)); },
  async getMembership() { return get<Membership>(K.member, NO_MEMBERSHIP); },
  async loadListings(member) {
    const f = await freeFile();
    if (!member) return f;
    const all = await previewMembersFile().catch(() => null);
    return all ? { items: all.filter((o) => !o.deadline || o.deadline >= TODAY), total: f.total, free: f.free } : f;
  },
  async listFollows() { return get<string[]>(K.follows, []); },
  async follow(id, on) { const f = get<string[]>(K.follows, []); put(K.follows, on ? [...new Set([...f, id])] : f.filter((x) => x !== id)); },
  async listSearches() { return get<SavedSearch[]>(K.searches, []); },
  async createSearch(name, filters) { const s: SavedSearch = { id: crypto.randomUUID(), name, filters, onsite: true, email: false, frequency: "instant", createdAt: TODAY }; put(K.searches, [...get<SavedSearch[]>(K.searches, []), s]); return s; },
  async updateSearch(id, patch) { put(K.searches, get<SavedSearch[]>(K.searches, []).map((s) => (s.id === id ? { ...s, ...patch } : s))); },
  async deleteSearch(id) { put(K.searches, get<SavedSearch[]>(K.searches, []).filter((s) => s.id !== id)); },
  async listNotices() { return get<Notice[]>(K.notices, []); },
  async markRead(ids) { const now = new Date().toISOString(); put(K.notices, get<Notice[]>(K.notices, []).map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, readAt: n.readAt ?? now } : n))); },
  async getPrefs() { return get<Prefs>(K.prefs, { ...DEFAULT_PREFS, calendarToken: "preview-token" }); },
  async setPrefs(p) { put(K.prefs, p); },
  async savePush() { await wait(100); },
  async listTodo() { return [{ id: 1, email: "reader@example.com", action: "comp", compUntil: null, createdAt: ago(3) }, { id: 2, email: "former@example.com", action: "remove", compUntil: null, createdAt: ago(20) }]; },
  async markTodoDone() { await wait(); },
  calendarUrl(token) { return token ? "webcal://amongtheletters.com/cal/••••••••••••.ics" : ""; },
};

/* Preview-only helpers, used by the review switcher. */
export function previewCheckout(plan: Plan) { put(K.member, { status: "active", plan, startedAt: TODAY, periodEnd: plan === "lifetime" ? null : later(plan === "annual" ? 12 : 1), source: "stripe", substack: "pending", isAdmin: false } satisfies Membership); }
export function previewCancel(on: boolean) { const m = get<Membership>(K.member, NO_MEMBERSHIP); put(K.member, { ...m, status: on ? "canceling" : "active" }); }
export function previewSetState(state: "visitor" | "free" | "member" | "canceling" | "substack") {
  Object.values(K).forEach((k) => localStorage.removeItem(k));
  if (state === "visitor") return;
  put(K.session, { userId: "preview-user", email: "reader@example.com", createdAt: "2026-10-26" } satisfies Session);
  if (state === "free") return;
  put(K.member, state === "substack"
    ? { status: "active", source: "substack", substack: "added", isAdmin: false }
    : { status: state === "member" ? "active" : "canceling", plan: "monthly", startedAt: "2026-10-26", periodEnd: "2026-11-26", source: "stripe", substack: "added", substackDate: "2026-10-26", isAdmin: true } satisfies Membership);
  put(K.notices, PREVIEW_NOTICES);
  put(K.searches, PREVIEW_SEARCHES);
  put(K.follows, ["cbc-short-story-2027", "trillium-residencies-2027"]);
}

// Review builds only: /opportunities/?as=member opens the page already in that pretend state.
if (MODE === "preview" && typeof window !== "undefined") {
  const u = new URL(window.location.href), as = u.searchParams.get("as");
  if (as && ["visitor", "free", "member", "canceling", "substack"].includes(as)) {
    previewSetState(as as Parameters<typeof previewSetState>[0]);
    u.searchParams.delete("as"); window.history.replaceState(null, "", u.pathname + u.search + u.hash);
  }
}

/* ======================= off (not configured) ======================= */
const off: typeof live = {
  ...preview,
  async getSession() { return null; },
  async getMembership() { return NO_MEMBERSHIP; },
  async loadListings() { return freeFile(); },
};

export const api = MODE === "live" ? live : MODE === "preview" ? preview : off;

export function checkoutUrl(plan: Plan, s: Session) {
  const base = plan === "lifetime" ? CONFIG.stripeLifetime : plan === "annual" ? CONFIG.stripeAnnual : CONFIG.stripeMonthly;
  if (!base) return "";
  return `${base}?client_reference_id=${encodeURIComponent(s.userId)}&locked_prefilled_email=${encodeURIComponent(s.email)}`;
}
export const portalUrl = (email: string) => (CONFIG.stripePortal ? `${CONFIG.stripePortal}?prefilled_email=${encodeURIComponent(email)}` : "");

/* Browser push, opt-in. Free through each browser's own push service. */
export const pushSupported = () => typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && !!CONFIG.vapidPublicKey;
export async function enablePush(): Promise<boolean> {
  if (MODE === "preview") { await wait(200); return true; }
  if (!pushSupported()) return false;
  if ((await Notification.requestPermission()) !== "granted") return false;
  const reg = await navigator.serviceWorker.register("/sw.js");
  const key = Uint8Array.from(atob(CONFIG.vapidPublicKey.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(CONFIG.vapidPublicKey.length / 4) * 4, "=")), (c) => c.charCodeAt(0));
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  await api.savePush(sub.toJSON());
  return true;
}
export async function disablePush() {
  if (MODE === "live" && "serviceWorker" in navigator) { const reg = await navigator.serviceWorker.getRegistration("/sw.js"); await (await reg?.pushManager.getSubscription())?.unsubscribe(); }
  await api.savePush(null);
}
