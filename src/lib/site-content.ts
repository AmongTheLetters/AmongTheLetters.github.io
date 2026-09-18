export const SUBSTACK_URL = "https://amongtheletters.substack.com/";

export const SITE = {
  name: "Among The Letters",
  kicker: "A literary gathering · Est. 2026",
  tagline: "Useful opportunities. Worthwhile writing. Curious things worth finding.",
  description: "Among The Letters gathers useful opportunities for writers and worthwhile things to read. Morning Opportunities appears on Mondays and Thursdays, while Afternoon Discoveries arrives daily on Substack.",
} as const;

export const NAV = [
  { href: "#briefing", label: "What You'll Find" },
  { href: "#inside", label: "How It Works" },
  { href: "#pricing", label: "Subscriptions" },
  { href: "#principles", label: "Our Approach" },
] as const;

export const PROOF = [
  { value: "Mon + Thu", label: "Fresh writing opportunities, jobs, contests, grants, and calls" },
  { value: "Every afternoon", label: "Books, authors, essays, stories, and literary discoveries" },
  { value: "Source checked", label: "Opportunities are checked against primary or authoritative sources" },
  { value: "$5 / month", label: "Full editions and expanded finds through Substack" },
] as const;

export const FEATURES = [
  { num: "01", title: "The searching is done for you", body: "Good opportunities are scattered everywhere. Among The Letters gathers them, checks the important details, and puts the useful parts in one place." },
  { num: "02", title: "Opportunities worth opening", body: "On Mondays and Thursdays, Morning Opportunities gathers writing and editorial work, contests, grants, fellowships, residencies, and calls for submissions." },
  { num: "03", title: "A daily reason to wander", body: "Afternoon Discoveries is for books, authors, essays, stories, poems, magazines, and curious literary finds that might otherwise pass you by." },
  { num: "04", title: "A changing shelf each day", body: "The afternoon edition moves through different corners of writing across the week, from poetry and literary fiction to speculative work, nonfiction, horror, romance, and more." },
  { num: "05", title: "Free is meant to be useful", body: "The free edition is not a teaser with the useful part missing. Paid editions simply make the gathering larger, with more opportunities, discoveries, and context." },
  { num: "06", title: "New is not the same as worthwhile", body: "A good piece of writing does not stop being good because the internet moved on. Older work can return as a special recommendation when it deserves another look." },
] as const;

export const GENRES = [
  { day: "Monday", genre: "Literary Fiction + Poetry" },
  { day: "Tuesday", genre: "Science Fiction + Fantasy" },
  { day: "Wednesday", genre: "Mystery, Thriller, Crime + Horror" },
  { day: "Thursday", genre: "Romance + Historical Fiction" },
  { day: "Friday", genre: "Creative Nonfiction + Essays" },
  { day: "Saturday", genre: "Speculative, Hybrid + Short Fiction" },
  { day: "Sunday", genre: "Emerging Writers + Worth Revisiting" },
] as const;

export const SAMPLE_JOBS = [
  { type: "Writing & editorial work", title: "Current paid roles and freelance work", meta: "With pay, location, eligibility, and application details when available" },
  { type: "Contests & prizes", title: "Open competitions worth considering", meta: "Deadlines, fees, prizes, and eligibility checked before inclusion" },
  { type: "Grants & residencies", title: "Time, funding, and places to make work", meta: "Primary links included so you can go straight to the source" },
] as const;
export const SAMPLE_OPPS = [
  { type: "Calls for submissions", title: "Places currently looking for work", meta: "Specific publications and projects, not vague category advice" },
  { type: "Featured opportunities", title: "A few finds that deserve a closer look", meta: "Extra context on why they may be worth your time" },
] as const;
export const SAMPLE_DISCOVERIES = [
  { type: "Featured discovery", title: "One piece, book, writer, or project to begin with", meta: "Chosen because there is something genuinely interesting there" },
  { type: "Around the shelves", title: "More writing and literary finds to wander through", meta: "New work, emerging voices, and older pieces worth revisiting" },
] as const;

export const PLANS = [
  { id: "free" as const, name: "Free", price: "$0", cadence: "forever", blurb: "Come wander without paying a thing.", cta: "Read free on Substack", featured: false, perks: ["Morning Opportunities on Mondays and Thursdays", "A useful selection of current opportunities", "Daily Afternoon Discoveries", "Featured finds and direct source links", "Delivered through Substack"] },
  { id: "full" as const, name: "Full", price: "$5", cadence: "per month", blurb: "For readers who want to wander a little farther.", cta: "See paid subscription on Substack", featured: true, perks: ["Everything in the free edition", "Expanded opportunity roundups", "More featured opportunities and useful context", "Expanded Afternoon Discoveries", "Special recommendations and worthwhile older finds", "Managed entirely through Substack"] },
] as const;

export const PRINCIPLES = [
  { title: "Useful before impressive", body: "The point is to find something you can actually read, enter, apply for, submit to, or remember. Utility gets the first seat at the table." },
  { title: "Check before sharing", body: "Opportunity details are checked against primary or authoritative sources." },
  { title: "Curiosity without the noise", body: "There is enough shouting online already. Among The Letters is meant to feel more like a curated list anyone can find something of interest in." },
  { title: "Leave room to wander", body: "Not every good discovery fits neatly into a trend, a release week, or an algorithm. Sometimes an older essay, an emerging writer, or an unexpected book is exactly the thing worth finding." },
] as const;

export const FAQ = [
  { q: "What is Among The Letters?", a: "A Substack publication for writers, readers, and curious people. It gathers legitimate writing opportunities and paid work, then returns in the afternoon with books, authors, essays, stories, publications, and other literary things worth finding." },
  { q: "When is it published?", a: "Morning Opportunities is planned for Mondays and Thursdays. Afternoon Discoveries is published daily. Everything lives on Substack, so subscribing there is the easiest way to keep up." },
  { q: "How are opportunities checked?", a: "Listings are checked against primary or authoritative sources before publication. Deadlines, eligibility, fees, pay, prizes, and application details are included when they can be confirmed. Secondary roundups can help uncover a lead, but they are not treated as the final source." },
  { q: "What will I find in Afternoon Discoveries?", a: "Books, authors, essays, stories, poems, literary magazines, writing projects, emerging voices, forthcoming work, and the occasional older piece that deserves another look. The focus changes through the week so the same corner of the bookshelf does not get all the attention." },
  { q: "Do I need a paid subscription?", a: "No. The free edition is meant to be worth reading on its own. A paid subscription expands the number of opportunities and discoveries and adds more featured material and context." },
  { q: "Where do I subscribe or manage billing?", a: "Everything subscription-related is handled by Substack. You can subscribe for free, choose the $5 monthly paid option, or manage an existing subscription from your Substack account." },
] as const;
