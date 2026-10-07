import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SUBSTACK_URL } from "@/lib/site-content";
import { cn } from "@/lib/utils";

export function SubstackLink({
  label = "Visit the newsletter on Substack",
  size = "lg",
  className,
  invert = false,
}: {
  label?: string;
  size?: "default" | "sm" | "lg";
  className?: string;
  invert?: boolean;
}) {
  return (
    <Button
      asChild
      size={size}
      variant={invert ? "outline" : "default"}
      className={cn(
        "min-w-0 max-w-full",
        invert &&
          "border border-parchment/30 bg-ink text-parchment hover:bg-parchment hover:text-ink",
        className,
      )}
    >
      <a href={SUBSTACK_URL} target="_blank" rel="noreferrer">
        <span className="min-w-0">{label}</span>
        <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
      </a>
    </Button>
  );
}
