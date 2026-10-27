/* Password box with a show or hide button inside it. The eye icons are inline SVG so no icon package is needed. */
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { autoComplete: "new-password" | "current-password" };

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput({ className, ...rest }, ref) {
  const [shown, setShown] = useState(false);
  return (
    <span className="relative mt-1 block">
      <input ref={ref} {...rest} type={shown ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false}
        className={cn(className, "mt-0 pr-12")} />
      <button type="button" onClick={() => setShown((s) => !s)} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}
        aria-controls={rest.id}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-faint transition-colors hover:text-oxblood focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-oxblood">
        {shown ? <EyeOff /> : <Eye />}
      </button>
    </span>
  );
});

const svg = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false };
function Eye() {
  return <svg {...svg}><path d="M2.06 12.35a1 1 0 0 1 0-.7C3.6 7.9 7.5 5 12 5s8.4 2.9 9.94 6.65a1 1 0 0 1 0 .7C20.4 16.1 16.5 19 12 19s-8.4-2.9-9.94-6.65Z" /><circle cx="12" cy="12" r="3" /></svg>;
}
function EyeOff() {
  return <svg {...svg}><path d="M10.73 5.08A10.4 10.4 0 0 1 12 5c4.5 0 8.4 2.9 9.94 6.65a1 1 0 0 1 0 .7 10.8 10.8 0 0 1-1.95 3.04" /><path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" /><path d="M17.48 17.5A10.7 10.7 0 0 1 12 19c-4.5 0-8.4-2.9-9.94-6.65a1 1 0 0 1 0-.7 10.8 10.8 0 0 1 4.45-5.14" /><path d="m2 2 20 20" /></svg>;
}
