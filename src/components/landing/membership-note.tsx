/* Founding lifetime membership note, shown under the "At a glance" boxes. */
import { ACCOUNTS_ON, CONFIG } from "@/lib/config";
import { MEMBERSHIP_URL } from "@/lib/site-content";

export function MembershipNote() {
  const live = ACCOUNTS_ON && !!CONFIG.stripeLifetime;
  return (
    <section aria-label="Founding lifetime memberships" className="pt-4 pb-2 md:pt-6">
      <div className="section-shell text-center">
      <p className="text-on-open mx-auto mt-4 max-w-xl text-sm">
        <a
          href={live ? `${MEMBERSHIP_URL}#founding` : "mailto:amongtheletters@gmail.com?subject=Founding%20Lifetime%20Membership%20Inquiry"}
          className="font-medium text-oxblood transition-colors hover:text-oxblood-dark hover:underline hover:underline-offset-4"
        >
          Founding lifetime memberships are available for $299 CAD.
          <br />
          Founding members get every paid feature for as long as the service runs, including the paid newsletter, the full opportunities database, all current guide PDFs and future products as they are added.
          <br />
          {live ? "See the membership page to join. It's a one-time payment and isn't refundable." : "Email amongtheletters@gmail.com for details."}
        </a>
      </p>
      </div>
    </section>
  );
}
