import { useEffect, useState } from "react";
import { api, isMember, type Membership, type Session } from "@/lib/backend";
import { ACCOUNTS_ON } from "@/lib/config";

export type AccountState = { ready: boolean; session: Session | null; membership: Membership | null; member: boolean };

/** Session and membership for the current visitor, shared by the header and pages. */
export function useAccount(): AccountState {
  const [st, setSt] = useState<AccountState>({ ready: !ACCOUNTS_ON, session: null, membership: null, member: false });
  useEffect(() => {
    if (!ACCOUNTS_ON) return;
    let alive = true;
    const load = async () => {
      const session = await api.getSession().catch(() => null);
      const membership = session ? await api.getMembership().catch(() => null) : null;
      if (alive) setSt({ ready: true, session, membership, member: !!membership && isMember(membership) });
    };
    load();
    const off = api.onAuthChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT" || e === "USER_UPDATED") load(); });
    return () => { alive = false; off(); };
  }, []);
  return st;
}
