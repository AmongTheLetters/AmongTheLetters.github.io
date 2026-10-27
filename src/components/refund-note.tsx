/* The membership refund policy, shown beside every join, upgrade and billing button. */
import { cn } from "@/lib/utils";

export const CONTACT_EMAIL = "amongtheletters@gmail.com";
export const LIFETIME_FINAL = "The founding membership is a one-time payment and isn't refundable.";

export function RefundNote({ className, inverse }: { className?: string; inverse?: boolean }) {
  return (
    <p className={cn("text-xs", inverse ? "text-parchment/60" : "text-faint", className)}>
      Memberships aren't refunded automatically, and you can cancel anytime. If you cancel early in a billing period,{" "}
      <a href={`mailto:${CONTACT_EMAIL}?subject=Membership%20cancellation`} className={cn("underline underline-offset-2", inverse ? "hover:text-parchment" : "hover:text-oxblood")}>write to us</a>{" "}
      and we'll take a look.
    </p>
  );
}
