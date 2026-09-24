export const SUBSTACK_URL = "https://amongtheletters.substack.com/";
export const ARCHIVE_URL = "/archive/";

export const SITE = {
  name: "Among The Letters",
  kicker: "A literary gathering · Est. 2026",
  tagline: "Useful opportunities. Worthwhile writing. Curious things worth finding.",
  description:
    "Among The Letters gathers useful opportunities for writers and worthwhile things to read. Morning Opportunities appears on Mondays, Afternoon Discoveries arrives every day, and paid subscribers receive a Sunday evening Weekly Discoveries Roundup.",
} as const;

export const NAV = [
  { href: "/#briefing", label: "What You'll Find" },
  { href: "/#inside", label: "How It Works" },
  { href: "/#pricing", label: "Subscriptions" },
  { href: ARCHIVE_URL, label: "Archive" },
  { href: "/#principles", label: "Our Approach" },
] as const;

export const PROOF = [
  { value: "Monday morning", label: "Writing work, contests, grants, residencies, and calls" },
  { value: "Every afternoon", label: "Books, authors, essays, stories, and literary discoveries" },
  { value: "Sunday evening", label: "A paid-subscriber Weekly Discoveries Roundup after the day's regular discovery edition" },
  { value: "Source checked", label: "Opportunities are checked against primary or authoritative sources" },
] as const;

export const FEATURES = [
  {
    num: "01",
    title: "The searching is done for you",
    body: "Good opportunities and good writing are scattered everywhere. Among The Letters gathers them, checks the important details, and puts the useful parts in one place.",
  },
  {
    num: "02",
    title: "Monday begins with opportunities",
    body: "Morning Opportunities gathers writing and editorial work, contests, grants, fellowships, residencies, and calls for submissions into one practical Monday briefing.",
  },
  {
    num: "03",
    title: "A discovery edition every afternoon",
    body: "Every day, Afternoon Discoveries turns toward books, authors, essays, stories, poems, magazines, and literary projects worth finding.",
  },
  {
    num: "04",
    title: "Sunday gathers the week back together",
    body: "On Sunday evening, paid subscribers receive a Weekly Discoveries Roundup that gathers the week back together after the regular Sunday Afternoon Discoveries edition.",
  },
  {
    num: "05",
    title: "Free is meant to be useful",
    body: "The free portion of regular Morning and Afternoon editions is not a teaser with the useful part missing. Paid editions expand the gathering with more opportunities, discoveries, and context.",
  },
  {
    num: "06",
    title: "New is not the same as worthwhile",
    body: "A good piece of writing does not stop being good because the internet moved on. Older, overlooked, or evergreen work can return as a Special Recommendation when it deserves another look.",
  },
] as const;

export const GENRES = [
  { day: "Monday", genre: "Literary Fiction + Poetry" },
  { day: "Tuesday", genre: "Science Fiction + Fantasy" },
  { day: "Wednesday", genre: "Mystery / Thriller / Crime + Horror / Dark Fiction" },
  { day: "Thursday", genre: "Romance / Women's Fiction + Historical Fiction" },
  { day: "Friday", genre: "Creative Nonfiction / Memoir + Essays & Narrative Journalism" },
  { day: "Saturday", genre: "Speculative / Hybrid / Experimental + Short Fiction & Flash" },
  { day: "Sunday", genre: "Emerging Writers + Worth Revisiting" },
] as const;

export const MORNING_SAMPLE = [
  {
    type: "Writing & editorial work",
    title: "Current paid roles and freelance work",
    meta: "Pay, location, eligibility, and application details are brought forward when they can be confirmed.",
  },
  {
    type: "Contests & prizes",
    title: "Open competitions worth considering",
    meta: "Deadlines, fees, prizes, and eligibility are checked before inclusion.",
  },
  {
    type: "Grants, fellowships & residencies",
    title: "Time, funding, and places to make work",
    meta: "Primary or authoritative links make it easy to continue from the source.",
  },
  {
    type: "Calls for submissions",
    title: "Specific places currently looking for work",
    meta: "Named publications and projects, rather than vague category advice.",
  },
] as const;

export const AFTERNOON_SAMPLE = [
  {
    type: "Featured Discovery",
    title: "One piece, book, writer, or project to begin with",
    meta: "A strong starting point chosen because there is something genuinely worthwhile there.",
  },
  {
    type: "The Discovery Desk",
    title: "Literary works from the day's two genres",
    meta: "Books, stories, poems, publications, and other writing worth opening.",
  },
  {
    type: "Beyond the First Shelf",
    title: "The conversation around the work",
    meta: "Interviews, literary journalism, author conversations, criticism, craft, and context.",
  },
  {
    type: "Special Recommendations",
    title: "Older, overlooked, or evergreen work worth returning to",
    meta: "Carefully selected additions in the expanded paid edition.",
  },
] as const;

export const ROUNDUP_SAMPLE = [
  {
    type: "Featured This Week",
    title: "The week's Featured Discoveries gathered in one place",
    meta: "A quick reminder of why each one mattered, with the original read-more link.",
  },
  {
    type: "The week, day by day",
    title: "A linked path back through the week's discoveries",
    meta: "Concise linked summaries make it easy to catch up or return to something you missed.",
  },
  {
    type: "Opportunities Worth Remembering",
    title: "A small Monday reminder when it is still useful",
    meta: "Selected Morning Opportunities can return on Sunday when they remain timely and worth acting on.",
  },
] as const;

export const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "Come wander without paying a thing.",
    cta: "Read free on Substack",
    featured: false,
    perks: [
      "The free portion of Monday Morning Opportunities",
      "A useful selection of current writing work and opportunities",
      "The free portion of daily Afternoon Discoveries",
      "Featured discoveries and direct source links",
      "Delivered through Substack",
    ],
  },
  {
    id: "full" as const,
    name: "Full",
    price: "$5",
    cadence: "per month",
    blurb: "For readers who want to wander a little farther.",
    cta: "See paid subscription on Substack",
    featured: true,
    perks: [
      "Everything in the free edition",
      "Expanded Monday opportunity roundups and featured opportunities",
      "Expanded Afternoon Discoveries every day",
      "Special Recommendations and deeper context",
      "The paid-subscriber-only Weekly Discoveries Roundup every Sunday",
      "Managed through Substack",
    ],
  },
] as const;

export const PRINCIPLES = [
  {
    title: "Useful before impressive",
    body: "The point is to find something you can actually read, enter, apply for, submit to, or remember. Utility gets the first seat at the table.",
  },
  {
    title: "Check before sharing",
    body: "Opportunity details are checked against primary or authoritative sources, and links are meant to take you back to the source rather than leave you guessing.",
  },
  {
    title: "Curiosity without the noise",
    body: "There is enough shouting online already. Among The Letters is meant to feel more like a considered gathering where anyone can find something of interest.",
  },
  {
    title: "Leave room to wander",
    body: "Not every good discovery fits neatly into a trend, a release week, or an algorithm. Sometimes an older essay, an emerging writer, or an unexpected book is exactly the thing worth finding.",
  },
] as const;

export const FAQ = [
  {
    q: "What is Among The Letters?",
    a: "A Substack publication for writers, readers, and curious people. It gathers legitimate writing opportunities and paid work, then returns through the week with books, authors, essays, stories, publications, and other literary things worth finding.",
  },
  {
    q: "When is it published?",
    a: "Morning Opportunities is published on Mondays. Afternoon Discoveries is published every day, Sunday through Saturday. On Sunday evening, paid subscribers also receive the Weekly Discoveries Roundup.",
  },
  {
    q: "What is the Sunday Weekly Discoveries Roundup?",
    a: "It is a compact paid-subscriber catch-up published on Sunday evening, after the regular Sunday Afternoon Discoveries edition. It gathers the week's Featured Discoveries, revisits the week with concise links, and may include a small reminder of Monday opportunities that are still timely.",
  },
  {
    q: "How are opportunities checked?",
    a: "Listings are checked against primary or authoritative sources before publication. Deadlines, eligibility, fees, pay, prizes, and application details are included when they can be confirmed. Secondary roundups can help uncover a lead, but they are not treated as the final source.",
  },
  {
    q: "What will I find in Afternoon Discoveries?",
    a: "Books, authors, essays, stories, poems, literary magazines, writing projects, emerging voices, forthcoming work, and carefully chosen older material. Afternoon Discoveries follows a seven-day genre rhythm so different corners of the bookshelf get their turn.",
  },
  {
    q: "Do I need a paid subscription?",
    a: "No. The free portion of regular Morning and Afternoon editions is meant to be worth reading on its own. A paid subscription expands those editions and includes the complete Sunday Weekly Discoveries Roundup.",
  },
  {
    q: "What is the $100 lifetime membership?",
    a: "It is an early founding offer from Among The Letters, separate from the standard monthly Substack plan. It includes lifetime access to the paid newsletter plus select future Among The Letters products released outside Substack. Those future extras are intentionally not promised by name before they exist.",
  },
  {
    q: "Where do I subscribe or manage billing?",
    a: "The standard newsletter subscription is handled by Substack. You can subscribe for free, choose the $5 monthly paid option, or manage an existing Substack subscription from your account. A separate $100 founding lifetime offer is available directly through Among The Letters.",
  },
] as const;
