import { cn } from "@/lib/utils";

export function Monogram({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
    >
      <rect width="32" height="32" rx="4" fill="currentColor" />
      <path
        d="M9.2 23V9.4h2.15l4.72 10.08L20.82 9.4H23V23h-1.86V12.55l-4.2 9.12h-1.7l-4.18-9.18V23H9.2Z"
        fill="var(--color-parchment)"
      />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <a
      href="#top"
      className={cn(
        "inline-flex items-center gap-2.5 text-ink transition-opacity duration-[var(--motion-quick)] hover:opacity-80",
        className,
      )}
    >
      <span className="font-display text-lg leading-none tracking-tight">
        <span className="italic">Among</span> the Letters
      </span>
    </a>
  );
}
