// Supabase Edge Function. NOT DEPLOYED. Draft for review.
// Receives Stripe events, keeps public.members in sync, and queues the Substack comp step.
// Secrets (set with `supabase secrets set`, never committed): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
import Stripe from "npm:stripe@17";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature") ?? "";
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), sig, Deno.env.get("STRIPE_WEBHOOK_SECRET")!);
  } catch {
    return new Response("bad signature", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const s = event.data.object as Stripe.Checkout.Session;
    const userId = s.client_reference_id; // set on the Payment Link URL by the account page
    if (!userId || !s.subscription) return new Response("ignored");
    const sub = await stripe.subscriptions.retrieve(String(s.subscription));
    const plan = sub.items.data[0]?.price.recurring?.interval === "year" ? "annual" : "monthly";
    const end = sub.items.data[0]?.current_period_end ?? (sub as unknown as { current_period_end: number }).current_period_end;
    const email = s.customer_details?.email ?? "";
    await db.from("members").upsert({ user_id: userId, email, status: "active", plan, stripe_customer_id: String(s.customer),
      stripe_subscription_id: sub.id, current_period_end: new Date(end * 1000).toISOString(), started_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    // Monthly members get a "forever" comp that is removed on cancellation, so there is no monthly
    // busywork. Yearly members get a one-year comp that is extended at each renewal.
    await db.from("substack_queue").insert({ user_id: userId, email, action: "comp", comp_until: plan === "annual" ? day(end) : null });
  }

  if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const end = sub.items.data[0]?.current_period_end ?? (sub as unknown as { current_period_end: number }).current_period_end;
    const status = event.type === "customer.subscription.deleted" ? "expired"
      : sub.cancel_at_period_end ? "canceling" : sub.status === "past_due" ? "past_due" : sub.status === "active" ? "active" : "expired";
    const { data: before } = await db.from("members").select("user_id,email,plan,current_period_end").eq("stripe_subscription_id", sub.id).maybeSingle();
    await db.from("members").update({ status, current_period_end: new Date(end * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("stripe_subscription_id", sub.id);
    if (before) {
      // Renewal moved the period end forward, so the Substack comp needs the same extension.
      if (before.plan === "annual" && status === "active" && before.current_period_end && new Date(end * 1000) > new Date(before.current_period_end))
        await db.from("substack_queue").insert({ user_id: before.user_id, email: before.email, action: "extend", comp_until: day(end) });
      // Removal is queued for every ended membership. Yearly comps also lapse by themselves.
      if (status === "expired") await db.from("substack_queue").insert({ user_id: before.user_id, email: before.email, action: "remove" });
    }
  }

  return new Response("ok");
});
