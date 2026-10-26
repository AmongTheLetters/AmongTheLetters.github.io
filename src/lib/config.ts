/*
 * Site config, read from Vite env at build time. Only public values belong here.
 *   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY   public by design, data is protected by row-level security
 *   VITE_STRIPE_LINK_MONTHLY, VITE_STRIPE_LINK_ANNUAL, VITE_STRIPE_PORTAL
 *   VITE_GOOGLE_SIGNIN=on                       shows "Continue with Google" (off unless set)
 *   VITE_VAPID_PUBLIC_KEY                       enables the browser push opt-in
 *   VITE_PREVIEW=1                              pretend accounts and the review banner, never in production
 * With no Supabase values the site runs in "off" mode: free listings only, and membership shows as opening soon.
 */
const env = import.meta.env;
export const CONFIG = {
  supabaseUrl: (env.VITE_SUPABASE_URL as string | undefined) || "",
  supabaseAnonKey: (env.VITE_SUPABASE_ANON_KEY as string | undefined) || "",
  stripeMonthly: (env.VITE_STRIPE_LINK_MONTHLY as string | undefined) || "",
  stripeAnnual: (env.VITE_STRIPE_LINK_ANNUAL as string | undefined) || "",
  stripePortal: (env.VITE_STRIPE_PORTAL as string | undefined) || "",
  googleSignIn: env.VITE_GOOGLE_SIGNIN === "on",
  vapidPublicKey: (env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "",
  preview: env.VITE_PREVIEW === "1",
  siteUrl: "https://amongtheletters.com",
};
export type Mode = "preview" | "live" | "off";
export const MODE: Mode = CONFIG.preview ? "preview" : CONFIG.supabaseUrl && CONFIG.supabaseAnonKey ? "live" : "off";
export const ACCOUNTS_ON = MODE !== "off";

export const PRICES = {
  monthly: { amount: 7, label: "$7", per: "a month", note: "Billed monthly in Canadian dollars. Cancel any time." },
  annual: { amount: 70, label: "$70", per: "a year", note: "Two months free. Billed yearly in Canadian dollars." },
} as const;
export type Plan = keyof typeof PRICES;
