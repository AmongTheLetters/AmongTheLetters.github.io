import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { api } from "@/lib/backend";
import { SHOW_WELCOME_POPUP, WELCOME_POPUP } from "@/lib/welcome-popup";

// On/off switch and content live in src/lib/welcome-popup.ts.
const STORAGE_KEY = WELCOME_POPUP.storageKey;

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
    if (!SHOW_WELCOME_POPUP || alreadyDismissed()) return;
    // Signed-in readers already have an account, so the newsletter promo stays out of their way.
    let cancelled = false;
    api.getSession().then((s) => { if (!cancelled && !s) setOpen(true); }, () => { if (!cancelled) setOpen(true); });
    return () => { cancelled = true; };
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
          {WELCOME_POPUP.title}
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
          src={WELCOME_POPUP.image}
          alt={WELCOME_POPUP.alt}
          fetchPriority="high"
          decoding="async"
          width={WELCOME_POPUP.width}
          height={WELCOME_POPUP.height}
          style={{ aspectRatio: `${WELCOME_POPUP.width} / ${WELCOME_POPUP.height}` }}
          className="h-[min(78dvh,40rem)] w-auto max-w-full rounded-lg bg-cream object-contain"
        />
      </div>
    </div>
  );
}
