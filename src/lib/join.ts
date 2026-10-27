/* One way into a paid plan from anywhere on the site. Signed out, it goes to sign-up first and comes back to
   the account page with the plan picked. Signed in, it opens that plan's Stripe Payment Link with the account id
   and locked email attached, the same as the account page does. */
import { checkoutUrl, type Session } from "@/lib/backend";
import { ACCOUNTS_ON, MODE, type Plan } from "@/lib/config";

export function joinTarget(plan: Plan, session: Session | null): string {
  if (!ACCOUNTS_ON) return "";
  if (!session) return `/account/?mode=signup&next=join&plan=${plan}`;
  if (MODE === "preview") return `/account/?plan=${plan}#join`;
  return checkoutUrl(plan, session) || `/account/?plan=${plan}#join`;
}

export function startJoin(plan: Plan, session: Session | null) {
  const to = joinTarget(plan, session);
  if (to) window.location.href = to;
}
