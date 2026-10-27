import { useEffect, useState } from "react";
import { api, isMember, previewSetState } from "@/lib/backend";
import { cn } from "@/lib/utils";

type St = "visitor" | "free" | "member" | "canceling" | "substack" | "founding" | "unconfirmed";
const LABEL: Record<St, string> = { visitor: "Signed out", free: "Free account", member: "Member", canceling: "Cancelling", substack: "Substack subscriber", founding: "Founding member", unconfirmed: "Unconfirmed email" };

/** Review builds only (VITE_PREVIEW=1). Switches between pretend account states. */
export function PreviewBar({ states }: { states: St[] }) {
  const [cur, setCur] = useState<St>("visitor");
  useEffect(() => {
    (async () => {
      const s = await api.getSession(); if (!s) return setCur("visitor");
      const m = await api.getMembership();
      setCur(!isMember(m) ? "free" : m.source === "substack" ? "substack" : m.plan === "lifetime" ? "founding" : m.status === "canceling" ? "canceling" : "member");
    })();
  }, []);
  return (
    <div className="relative z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-ink px-4 py-1.5 text-xs font-medium tracking-wide text-parchment">
      <span>Review build with pretend accounts. View as</span>
      {states.map((s) => (
        <button key={s} type="button" onClick={() => { previewSetState(s); window.location.href = window.location.pathname; }}
          className={cn("rounded px-2 py-0.5", cur === s ? "bg-gold text-ink" : "bg-parchment/10 hover:bg-parchment/20")}>{LABEL[s]}</button>
      ))}
    </div>
  );
}
