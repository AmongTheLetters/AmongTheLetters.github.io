// Supabase Edge Function `stripe-webhook`. Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// Keeps public.members in sync with Stripe and adds Substack tasks to the to-do list.
// Secrets (supabase secrets set ..., never committed): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const ts = (t: number) => new Date(t * 1000).toISOString();
// Newer Stripe API versions keep the period end on the subscription item, older ones on the subscription.
const periodEnd = (sub: Stripe.Subscription): number =>
  (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end ??
  (sub as unknown as { current_period_end: number }).current_period_end;

async function onAllowlist(email: string) {
  const { data } = await db.from("substack_allowlist").select("email").eq("email", email.toLowerCase()).eq("active", true).maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), req.headers.get("stripe-signature") ?? "", Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.client_reference_id; // added to the Payment Link URL by the account page
      // Other Minocy sales share this Stripe account, so skip anything that is not an ATL member checkout.
      if (!userId || !s.subscription || !/^[0-9a-f-]{36}$/i.test(userId)) return new Response("ignored");
      const { data: u } = await db.auth.admin.getUserById(userId);
      if (!u?.user) return new Response("unknown user", { status: 200 });
      const email = (u.user.email ?? s.customer_details?.email ?? "").toLowerCase();
      const sub = await stripe.subscriptions.retrieve(String(s.subscription));
      const plan = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
      const end = periodEnd(sub);
      const { error } = await db.from("members").upsert({
        user_id: userId, email, status: "active", plan, stripe_customer_id: String(s.customer), stripe_subscription_id: sub.id,
        current_period_end: ts(end), started_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      // Monthly members get a "forever" comp, removed on cancellation. Yearly members get one year, extended at renewal.
      // People already paying on Substack do not need a comp.
      if (!(await onAllowlist(email))) await db.from("substack_queue").insert({ user_id: userId, email, action: "comp", comp_until: plan === "annual" ? day(end) : null });
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const end = periodEnd(sub);
      const status = event.type === "customer.subscription.deleted" ? "expired"
        : sub.status === "past_due" || sub.status === "unpaid" ? "past_due"
        : sub.status === "active" || sub.status === "trialing" ? (sub.cancel_at_period_end || sub.cancel_at ? "canceling" : "active")
        : "expired";
      const { data: before } = await db.from("members").select("user_id,email,plan,current_period_end").eq("stripe_subscription_id", sub.id).maybeSingle();
      const plan = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly"; // the portal allows switching
      await db.from("members").update({ status, plan, current_period_end: ts(end), updated_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id);
      if (before) {
        const renewed = before.current_period_end && new Date(end * 1000) > new Date(before.current_period_end);
        if (before.plan === "annual" && status === "active" && renewed && !(await onAllowlist(before.email)))
          await db.from("substack_queue").insert({ user_id: before.user_id, email: before.email, action: "extend", comp_until: day(end) });
        if (status === "expired" && !(await onAllowlist(before.email)))
          await db.from("substack_queue").insert({ user_id: before.user_id, email: before.email, action: "remove" });
      }
    }
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 }); // Stripe retries
  }
  return new Response("ok");
});
