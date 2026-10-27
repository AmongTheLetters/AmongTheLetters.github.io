/* Only one header menu (main navigation, account, notifications) is open at a time. A menu that opens
   announces itself, and any other open menu closes, the same as a click outside it. */
import { useEffect, useId } from "react";

const EVENT = "atl:menu-open";

export function useExclusiveMenu(open: boolean, close: () => void) {
  const id = useId();
  useEffect(() => {
    if (!open) return;
    window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
    const onOther = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) close(); };
    window.addEventListener(EVENT, onOther);
    return () => window.removeEventListener(EVENT, onOther);
    // close is a state setter wrapper, stable enough for this purpose
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);
}
