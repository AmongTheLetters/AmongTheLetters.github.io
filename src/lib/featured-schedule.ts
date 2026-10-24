/*
 * Upcoming featured schedule, built from the ATL featured calendar (Nov 2026 to Oct 2027).
 * Set confirmed to true once a title is final, otherwise the site shows "Title coming soon".
 */
export type ScheduledFeature = {
  live: string; // go-live date, YYYY-MM-DD
  occasion: string;
  title: string;
  confirmed: boolean;
  list?: boolean; // larger list feature
};

export const FEATURED_SCHEDULE: ScheduledFeature[] = [
  { live: "2026-11-04", occasion: "Remembrance Day", title: "What the Poppies Keep", confirmed: false },
  { live: "2026-11-19", occasion: "American Thanksgiving", title: "A Table Set for Stories", confirmed: false },
  { live: "2026-12-04", occasion: "Early December feature", title: "The Gift of a Book", confirmed: false },
  { live: "2026-12-18", occasion: "Christmas", title: "Snowlight and Story", confirmed: false },
  { live: "2027-01-01", occasion: "New Year's Day", title: "Top 10 of 2026 in Each Genre", confirmed: true, list: true },
  { live: "2027-01-08", occasion: "The year in reading", title: "Top 100 of 2026 in Each Genre", confirmed: true, list: true },
  { live: "2027-01-18", occasion: "Burns Night", title: "A Toast to the Bard", confirmed: false },
  { live: "2027-02-07", occasion: "Valentine's Day and Family Day", title: "The People We Read For", confirmed: false },
  { live: "2027-02-22", occasion: "Late winter feature", title: "Letters Kept in Drawers", confirmed: false },
  { live: "2027-03-10", occasion: "St. Patrick's Day", title: "Green Ink", confirmed: false },
  { live: "2027-03-19", occasion: "Easter", title: "Spring Tide", confirmed: false },
  { live: "2027-04-01", occasion: "National Poetry Month", title: "Poems for Every Pocket", confirmed: false },
  { live: "2027-04-16", occasion: "World Book and Copyright Day", title: "Libraries and the Lives Inside Them", confirmed: false },
  { live: "2027-05-02", occasion: "Mother's Day", title: "In Our Mothers' Words", confirmed: false },
  { live: "2027-05-17", occasion: "Victoria Day", title: "The Long Weekend Shelf", confirmed: false },
  { live: "2027-06-01", occasion: "National Indigenous Peoples Day", title: "Stories Carried Forward", confirmed: false },
  { live: "2027-06-09", occasion: "Father's Day", title: "Notes From Our Fathers", confirmed: false },
  { live: "2027-06-17", occasion: "Fête nationale du Québec", title: "La fête des mots", confirmed: false },
  { live: "2027-06-24", occasion: "Canada Day", title: "Coast to Coast to Coast", confirmed: false },
  { live: "2027-07-07", occasion: "Bastille Day", title: "Liberté on the Page", confirmed: false },
  { live: "2027-07-26", occasion: "Civic Holiday", title: "Summer in the Neighbourhood", confirmed: false },
  { live: "2027-08-13", occasion: "Summer feature", title: "Books for the Road", confirmed: false },
  { live: "2027-08-30", occasion: "Labour Day", title: "The Work of Our Hands", confirmed: false },
  { live: "2027-09-12", occasion: "Autumn feature", title: "Back to the Desk", confirmed: false },
  { live: "2027-09-23", occasion: "National Day for Truth and Reconciliation", title: "Listening First", confirmed: false },
  { live: "2027-10-04", occasion: "Thanksgiving", title: "Harvest Pages", confirmed: false },
  { live: "2027-10-24", occasion: "Halloween", title: "Candles in the Window", confirmed: false },
];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parse(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLive(iso: string) {
  const d = parse(iso);
  return { weekday: DAYS[d.getDay()], day: d.getDate(), month: MONTHS[d.getMonth()], year: d.getFullYear() };
}

/* Entries that go live after today, so the list stays current without edits. */
export function upcomingFeatures(limit = 5, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return FEATURED_SCHEDULE.filter((f) => parse(f.live) > start).slice(0, limit);
}

/* The rest of the year grouped by month, occasions only. */
export function yearByMonth(today = new Date()) {
  const groups: { label: string; occasions: string[] }[] = [];
  for (const f of upcomingFeatures(FEATURED_SCHEDULE.length, today)) {
    const { month, year } = formatLive(f.live);
    const label = `${month} ${year}`;
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.occasions.push(f.occasion);
    else groups.push({ label, occasions: [f.occasion] });
  }
  return groups;
}
