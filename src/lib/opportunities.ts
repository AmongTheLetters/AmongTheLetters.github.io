/* Shared listing types, dates and filter logic. The alerts Edge Function uses a copy of matches(). */
export type OppType = "Contest" | "Call for submissions" | "Grant" | "Residency" | "Fellowship" | "Mentorship" | "Paid market";
export type Opp = {
  id: string; title: string; org: string; type: OppType; genres: string[]; region: string; location: string; eligibility: string;
  opens?: string | null; deadline: string | null; deadlineNote?: string | null; fee: "Free" | "Fee" | "Check"; award: string; summary: string;
  url: string; verified: string; added: string; tier: "free" | "members";
};
export type Stub = { id: string; locked: true; type: OppType; region: string; genres: string[]; fee: Opp["fee"]; deadline: string | null; added: string };
export type Item = Opp | Stub;
export const isStub = (i: Item): i is Stub => "locked" in i;

export const TYPES: OppType[] = ["Contest", "Call for submissions", "Grant", "Residency", "Fellowship", "Mentorship", "Paid market"];
export const REGIONS = ["Canada", "United States", "International"];
export const WINDOWS = [["any", "Any deadline"], ["7", "Next 7 days"], ["30", "Next 30 days"], ["90", "Next 90 days"], ["rolling", "Rolling or open now"]] as const;
export type Win = (typeof WINDOWS)[number][0];
export type SortKey = "deadline" | "added" | "name";
export type Filters = { q: string; type: string; region: string; genre: string; win: Win; freeOnly: boolean; savedOnly: boolean; sort: SortKey };
export const EMPTY: Filters = { q: "", type: "All", region: "All regions", genre: "All genres", win: "any", freeOnly: false, savedOnly: false, sort: "deadline" };

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const pad = (n: number) => String(n).padStart(2, "0");
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d || 1); };
export const TODAY = iso(new Date());
export const daysUntil = (s: string) => Math.round((parse(s).getTime() - parse(TODAY).getTime()) / 86400000);
export const fullDate = (s: string) => { const d = parse(s); return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`; };
export const longDate = (s?: string | null) => { if (!s) return ""; const d = parse(s.slice(0, 10)); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
export const monthOnly = (s: string) => { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
export function timeAgo(ts: string) {
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins} minutes ago`;
  const h = Math.round(mins / 60); if (h < 24) return h === 1 ? "An hour ago" : `${h} hours ago`;
  const d = Math.round(h / 24); return d === 1 ? "Yesterday" : `${d} days ago`;
}

/** Does a listing match a saved filter set? (search text is ignored for stubs) */
export function matches(i: Item, f: Filters, saved: string[] = []) {
  if (i.deadline && i.deadline.length === 10 && i.deadline < TODAY) return false;
  if (f.type !== "All" && i.type !== f.type) return false;
  if (f.region !== "All regions" && i.region !== f.region) return false;
  if (f.genre !== "All genres" && !i.genres.includes(f.genre)) return false;
  if (f.freeOnly && i.fee !== "Free") return false;
  if (f.savedOnly && !saved.includes(i.id)) return false;
  if (f.win === "rolling" && i.deadline) return false;
  if (f.win !== "any" && f.win !== "rolling") {
    if (!i.deadline) return false;
    const d = i.deadline.length === 7 ? `${i.deadline}-01` : i.deadline;
    if (daysUntil(d) > Number(f.win)) return false;
  }
  const needle = f.q.trim().toLowerCase();
  if (needle) {
    if (isStub(i)) return false;
    if (![i.title, i.org, i.location, i.eligibility, i.summary, i.type, ...i.genres].join(" ").toLowerCase().includes(needle)) return false;
  }
  return true;
}

export function describeFilters(f: Partial<Filters>): string[] {
  const out: string[] = [];
  if (f.type && f.type !== "All") out.push(f.type);
  if (f.region && f.region !== "All regions") out.push(f.region);
  if (f.genre && f.genre !== "All genres") out.push(f.genre);
  if (f.win && f.win !== "any") out.push(f.win === "rolling" ? "Rolling or open now" : `Closes within ${f.win} days`);
  if (f.freeOnly) out.push("Free to enter");
  if (f.q) out.push(`“${f.q}”`);
  return out.length ? out : ["Everything"];
}
export const searchName = (f: Partial<Filters>) => describeFilters(f).join(", ");

/* ---------- calendar export ---------- */
const icsEsc = (s: string) => s.replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
export function downloadIcs(list: Opp[], name: string) {
  const rows = list.filter((o) => o.deadline).map((o) => {
    const d = o.deadline!.replace(/-/g, "");
    const next = iso(new Date(parse(o.deadline!).getTime() + 86400000)).replace(/-/g, "");
    return ["BEGIN:VEVENT", `UID:atl-opp-${o.id}@amongtheletters.com`, `DTSTAMP:${TODAY.replace(/-/g, "")}T120000Z`, `DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${icsEsc(`Deadline, ${o.org} ${o.title}`)}`, `DESCRIPTION:${icsEsc(`${o.summary} ${o.deadlineNote ?? ""} ${o.url}`)}`, `URL:${o.url}`,
      "BEGIN:VALARM", "TRIGGER:-P7D", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc(`One week left, ${o.title}`)}`, "END:VALARM", "END:VEVENT"].join("\r\n");
  });
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Among The Letters//Opportunities//EN", "CALSCALE:GREGORIAN", ...rows, "END:VCALENDAR"].join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
