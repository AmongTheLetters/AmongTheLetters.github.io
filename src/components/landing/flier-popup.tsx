import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "atl-flier-dismissed";

function alreadyDismissed() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Ignore storage failures; the popup will still close for this visit.
  }
}

export function FlierPopup() {
  const labelId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (alreadyDismissed()) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        dismiss();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function dismiss() {
    rememberDismissed();
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px]"
      onClick={dismiss}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        className="relative flex max-h-[90dvh] w-full max-w-[min(90vw,28rem)] flex-col items-center rounded-xl bg-cream p-3 shadow-[var(--shadow-border-hover)] sm:p-4"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={labelId} className="sr-only">
          Among The Letters flier
        </h2>

        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full border border-rule bg-paper text-ink shadow-[var(--shadow-border)] transition-colors hover:bg-oxblood hover:text-parchment focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oxblood"
          aria-label="Close flier"
        >
          <X className="size-4" strokeWidth={2.25} />
        </button>

        <img
          src="/images/atl-flier.png"
          alt="Among The Letters flier"
          width={1025}
          height={1535}
          className="max-h-[min(82dvh,calc(90dvh-2.5rem))] w-auto max-w-full rounded-lg object-contain"
        />
      </div>
    </div>
  );
}
