// Supabase Edge Function `stripe-webhook`. Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// Keeps public.members in sync with Stripe and adds Substack tasks to the to-do list.
// Handles monthly and yearly subscriptions and the one-time lifetime payment. Lifetime is never downgraded.
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

// The CA$299 one-time lifetime Payment Link. Its sessions also carry metadata atl_plan=lifetime.
const LIFETIME_LINK = Deno.env.get("ATL_LIFETIME_LINK") || "plink_1UVBxURrwe7mDXay8xCJYKbF";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = ["active", "past_due", "canceling"];

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
      const lifetime = s.mode === "payment" && (s.payment_link === LIFETIME_LINK || s.metadata?.atl_plan === "lifetime");
      // Other Minocy sales share this Stripe account, so skip anything that is not an ATL member checkout.
      if (!userId || !UUID.test(userId) || (!lifetime && !s.subscription)) return new Response("ignored");
      const { data: u } = await db.auth.admin.getUserById(userId);
      if (!u?.user) return new Response("unknown user", { status: 200 });
      const email = (u.user.email ?? s.customer_details?.email ?? "").toLowerCase();
      const { data: prev } = await db.from("members").select("plan,status,current_period_end,stripe_subscription_id,started_at").eq("user_id", userId).maybeSingle();
      const prevLifetime = prev?.plan === "lifetime" && prev.status === "active";
      const prevSub = !!prev && !prevLifetime && !!prev.stripe_subscription_id && ACTIVE.includes(prev.status) &&
        !!prev.current_period_end && new Date(prev.current_period_end) > new Date();
      const now = new Date().toISOString();

      if (lifetime) {
        if (s.payment_status !== "paid") { console.warn("lifetime checkout not paid yet", s.id, s.payment_status); return new Response("not paid"); }
        if (prevLifetime) { console.warn("already a lifetime member, check for a duplicate payment", userId, s.id); return new Response("already lifetime"); }
        const { error } = await db.from("members").upsert({
          user_id: userId, email, status: "active", plan: "lifetime", stripe_customer_id: s.customer ? String(s.customer) : null,
          stripe_subscription_id: null, current_period_end: null, started_at: prevSub && prev?.started_at ? prev.started_at : now, updated_at: now,
        });
        if (error) throw error;
        // Lifetime gets a "forever" comp. A monthly comp is already forever, a yearly one is extended to forever.
        if (!(await onAllowlist(email))) {
          if (!prevSub) await db.from("substack_queue").insert({ user_id: userId, email, action: "comp", comp_until: null });
          else if (prev?.plan === "annual") await db.from("substack_queue").insert({ user_id: userId, email, action: "extend", comp_until: null });
        }
        // Never cancel the old subscription automatically. A person cancels it in Stripe so it stops billing.
        if (prevSub && prev) {
          const note = `Bought lifetime (${s.id}). Cancel the old ${prev.plan} subscription ${prev.stripe_subscription_id} in Stripe so it stops billing.`;
          console.log(note);
          await db.from("substack_queue").insert({ user_id: userId, email, action: "cancel_subscription", note });
        }
        return new Response("ok");
      }

      const sub = await stripe.subscriptions.retrieve(String(s.subscription));
      if (prevLifetime) {
        // Already lifetime, so keep it and flag the new subscription for cancelling.
        const note = `Already a lifetime member but started subscription ${sub.id} (${s.id}). Cancel it in Stripe and refund it.`;
        console.warn(note);
        await db.from("substack_queue").insert({ user_id: userId, email, action: "cancel_subscription", note });
        return new Response("ok");
      }
      const plan = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
      const end = periodEnd(sub);
      const { error } = await db.from("members").upsert({
        user_id: userId, email, status: "active", plan, stripe_customer_id: String(s.customer), stripe_subscription_id: sub.id,
        current_period_end: ts(end), started_at: now, updated_at: now,
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
      // Lifetime rows hold no subscription, so an old subscription ending later never matches. This is a second guard.
      if (before?.plan === "lifetime") return new Response("lifetime, ignored");
      const plan = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly"; // the portal allows switching
      await db.from("members").update({ status, plan, current_period_end: ts(end), updated_at: new Date().toISOString() })
        .eq("stripe_subscription_id", sub.id).or("plan.is.null,plan.neq.lifetime");
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
