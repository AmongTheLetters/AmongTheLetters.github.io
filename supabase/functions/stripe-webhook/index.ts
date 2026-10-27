// Supabase Edge Function `stripe-webhook`. Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// Keeps public.members in sync with Stripe and adds Substack tasks to the to-do list.
// Handles monthly and yearly subscriptions and the one-time lifetime payment. Lifetime is never downgraded.
// Secrets (supabase secrets set ..., never committed): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Optional Stripe test mode, for test purchases with 4242 cards: STRIPE_SECRET_KEY_TEST, STRIPE_WEBHOOK_SECRET_TEST,
// and ATL_LIFETIME_LINK_TEST. Live events always verify with the live secret and use the live key, as before.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripeLive = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const testKey = Deno.env.get("STRIPE_SECRET_KEY_TEST"), testSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET_TEST");
const stripeTest = testKey ? new Stripe(testKey) : null;
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
const ts = (t: number) => new Date(t * 1000).toISOString();
// Newer Stripe API versions keep the period end on the subscription item, older ones on the subscription.
const periodEnd = (sub: Stripe.Subscription): number =>
  (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end ??
  (sub as unknown as { current_period_end: number }).current_period_end;

// The CA$299 one-time lifetime Payment Link. Its sessions also carry metadata atl_plan=lifetime.
const LIFETIME_LINK = Deno.env.get("ATL_LIFETIME_LINK") || "plink_1UVBxURrwe7mDXay8xCJYKbF";
const LIFETIME_LINK_TEST = Deno.env.get("ATL_LIFETIME_LINK_TEST") || "";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIVE = ["active", "past_due", "canceling"];

// Cancel a subscription right away (no proration). If the Stripe key cannot (a read-only restricted key),
// fall back to a "Cancel old plan" item on the admin to-do list. Never throws.
// review = also leave a to-do even when the cancel works, for a duplicate plan Chris may choose to refund by hand.
async function cancelOld(stripe: Stripe, subId: string, userId: string, email: string, why: string, review = false) {
  const reviewNote = review ? " Review whether to refund the duplicate plan, Chris decides." : "";
  try {
    await stripe.subscriptions.cancel(subId);
    console.log(`${why} ${subId} was cancelled automatically.`);
    if (review) {
      const { error } = await db.from("substack_queue").insert({ user_id: userId, email, action: "cancel_subscription",
        note: `${why} ${subId} was cancelled automatically, nothing to cancel.${reviewNote}` });
      if (error) console.error("could not add the review to-do", error);
    }
  } catch (e) {
    const reason = (e as { type?: string; message?: string })?.type ?? "error";
    const note = `${why} ${subId} could not be cancelled automatically (${reason}). Cancel it in Stripe now so it stops billing.${reviewNote}`;
    console.warn(note);
    const { error } = await db.from("substack_queue").insert({ user_id: userId, email, action: "cancel_subscription", note });
    if (error) console.error("could not add the cancel to-do", error);
  }
}

async function onAllowlist(email: string) {
  const { data } = await db.from("substack_allowlist").select("email").eq("email", email.toLowerCase()).eq("active", true).maybeSingle();
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
  let event: Stripe.Event;
  const body = await req.text(), sig = req.headers.get("stripe-signature") ?? "";
  try {
    event = await stripeLive.webhooks.constructEventAsync(body, sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch {
    // Not signed with the live secret. Accept it only as a test mode event signed with the test secret.
    try {
      if (!testSecret || !stripeTest) throw new Error("no test mode");
      event = await stripeTest.webhooks.constructEventAsync(body, sig, testSecret);
      if (event.livemode) throw new Error("live event with the test secret");
    } catch {
      return new Response("bad signature", { status: 400 });
    }
  }
  // Each mode uses its own key, so a test event can never touch a live subscription.
  const stripe = event.livemode ? stripeLive : stripeTest;
  if (!stripe) return new Response("test mode not configured");
  const lifetimeLink = event.livemode ? LIFETIME_LINK : LIFETIME_LINK_TEST;

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      const userId = s.client_reference_id; // added to the Payment Link URL by the account page
      const lifetime = s.mode === "payment" && ((!!lifetimeLink && s.payment_link === lifetimeLink) || s.metadata?.atl_plan === "lifetime");
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
          stripe_subscription_id: null, current_period_end: null, comped: false, started_at: prevSub && prev?.started_at ? prev.started_at : now, updated_at: now,
        });
        if (error) throw error;
        // The row is lifetime from here on. Nothing below may fail the webhook, or a retry would skip these steps.
        try {
          // Lifetime gets a "forever" comp. A monthly comp is already forever, a yearly one is extended to forever.
          if (!(await onAllowlist(email))) {
            if (!prevSub) await db.from("substack_queue").insert({ user_id: userId, email, action: "comp", comp_until: null });
            else if (prev?.plan === "annual") await db.from("substack_queue").insert({ user_id: userId, email, action: "extend", comp_until: null });
          }
          // Stop the old subscription now so nobody pays twice. The row no longer holds its id, so the
          // customer.subscription.deleted event that follows matches nothing and queues no Substack removal.
          if (prevSub && prev) await cancelOld(stripe, String(prev.stripe_subscription_id), userId, email, `Bought lifetime (${s.id}). The old ${prev.plan} subscription`);
        } catch (e) { console.error("lifetime follow-up failed", s.id, e); }
        return new Response("ok");
      }

      const sub = await stripe.subscriptions.retrieve(String(s.subscription));
      if (prevLifetime) {
        // Already lifetime, so keep it and flag the new subscription for cancelling.
        await cancelOld(stripe, sub.id, userId, email, `Already a lifetime member but started a subscription (${s.id}). The subscription`, true);
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
