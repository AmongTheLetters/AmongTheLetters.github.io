/*
 * Account and membership layer.
 *
 * PREVIEW ONLY. This file is a stand-in that keeps a fake session in localStorage so the pages
 * can be reviewed without any accounts or payments. At launch it is replaced by a thin wrapper
 * around supabase-js with the same exported functions (see supabase/README.md).
 *   signUp / signIn            supabase.auth.signUpWithPassword / signInWithPassword / signInWithOtp
 *   getSession / signOut       supabase.auth.getSession / signOut
 *   getMembership              select from public.members where user_id = auth.uid()   (RLS)
 *   checkoutUrl                Stripe Payment Link with client_reference_id and locked_prefilled_email
 *   billingPortalUrl           Stripe customer portal login link
 * Nothing here is a security boundary. In production the members-only rows are protected by
 * Postgres row-level security, so a visitor without an active membership cannot read them at all.
 */

export type Plan = "monthly" | "annual";
export type MemberStatus = "none" | "active" | "past_due" | "canceling" | "expired";
export type SubstackComp = "not_started" | "pending" | "added" | "removal_pending" | "removed";

export type Session = { userId: string; email: string; createdAt: string };
export type Membership = {
  status: MemberStatus;
  plan?: Plan;
  periodEnd?: string;
  startedAt?: string;
  substack: SubstackComp;
  substackDate?: string;
};
export type AlertPrefs = { weekly: boolean; closingSoon: boolean; savedSearches: boolean; calendarFeed: boolean };

export const PRICES: Record<Plan, { amount: number; label: string; per: string; note: string }> = {
  monthly: { amount: 8, label: "$8", per: "a month", note: "Billed monthly in Canadian dollars. Cancel any time." },
  annual: { amount: 80, label: "$80", per: "a year", note: "Two months free. Billed yearly in Canadian dollars." },
};

/* Filled in at launch. */
export const STRIPE_LINKS: Record<Plan, string> = { monthly: "https://buy.stripe.com/PLACEHOLDER_MONTHLY", annual: "https://buy.stripe.com/PLACEHOLDER_ANNUAL" };
export const STRIPE_PORTAL = "https://billing.stripe.com/p/login/PLACEHOLDER";

const K = { session: "atl-mock-session", member: "atl-mock-membership", alerts: "atl-mock-alerts" };
const get = <T,>(k: string): T | null => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null; } catch { return null; } };
const put = (k: string, v: unknown) => localStorage.setItem(k, JSON.stringify(v));
const today = () => new Date().toISOString().slice(0, 10);
const addMonths = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d.toISOString().slice(0, 10); };

export function getSession(): Session | null { return get<Session>(K.session); }
export function getMembership(): Membership { return get<Membership>(K.member) ?? { status: "none", substack: "not_started" }; }
export function isMember(m: Membership = getMembership()) { return m.status === "active" || m.status === "canceling" || m.status === "past_due"; }

export async function signUp(email: string, _password: string): Promise<Session> {
  await new Promise((r) => setTimeout(r, 400));
  const s = { userId: crypto.randomUUID(), email: email.trim().toLowerCase(), createdAt: today() };
  put(K.session, s);
  return s;
}
export const signIn = signUp;
export function signOut() { localStorage.removeItem(K.session); localStorage.removeItem(K.member); }

/* Preview stand-in for "Stripe Checkout succeeded and the webhook updated public.members". */
export function mockCompleteCheckout(plan: Plan) {
  put(K.member, { status: "active", plan, startedAt: today(), periodEnd: addMonths(plan === "annual" ? 12 : 1), substack: "pending" } satisfies Membership);
}
/* Preview stand-in for "member clicked Cancel in the Stripe portal". Access runs to the period end. */
export function mockCancel() {
  const m = getMembership();
  put(K.member, { ...m, status: "canceling", substack: m.substack === "added" ? "added" : m.substack });
}
export function mockResume() { const m = getMembership(); put(K.member, { ...m, status: "active" }); }

export function getAlertPrefs(): AlertPrefs { return get<AlertPrefs>(K.alerts) ?? { weekly: true, closingSoon: true, savedSearches: false, calendarFeed: false }; }
export function setAlertPrefs(p: AlertPrefs) { put(K.alerts, p); }

/* Preview helper: jump straight to a state for review. */
export function mockSetState(state: "visitor" | "free" | "member" | "canceling") {
  if (state === "visitor") { signOut(); return; }
  put(K.session, { userId: "preview-user", email: "reader@example.com", createdAt: "2026-10-26" } satisfies Session);
  if (state === "free") localStorage.removeItem(K.member);
  else put(K.member, { status: state === "member" ? "active" : "canceling", plan: "monthly", startedAt: "2026-10-26", periodEnd: "2026-11-26", substack: "added", substackDate: "2026-10-26" } satisfies Membership);
}
