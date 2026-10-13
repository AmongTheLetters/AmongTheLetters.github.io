export const RESOURCE_IMAGE_BASE = "/images/resources";
export const RESOURCE_FILE_BASE = "/resources";

export type ResourceFile = { label: string; href: string; size: string };

export type Resource = {
  id: string;
  slug: string;
  title: string;
  description: string;
  pages: string;
  orientation: "portrait" | "landscape";
  alt: string;
  files: readonly ResourceFile[];
};

export type ResourceCategory = {
  id: string;
  kicker: string;
  title: string;
  intro: string;
  items: readonly Resource[];
  /** A category can also be a single reference page (e.g. the glossary) instead of downloads. */
  feature?: ResourceFeature;
};

export type ResourceFeature = {
  href: string;
  title: string;
  description: string;
  facts: readonly string[];
  sample: readonly string[];
  cta: string;
};

export const GLOSSARY_CATEGORY: ResourceCategory = {
  id: "glossary",
  kicker: "Glossary",
  title: "The words around the writing, explained.",
  intro: "Plain definitions of the terms you meet in guidelines, rejections, contracts, and contest rules, each with what it means for you in practice.",
  items: [],
  feature: {
    href: "/resources/glossary/",
    title: "A Plain-Language Glossary for Writers",
    description: "From simultaneous submissions to FNASR, reading fees to revise and resubmit. Searchable, arranged by topic or A to Z, with a link for every term.",
    facts: ["70 terms", "5 topics", "Free to read online"],
    sample: ["Simultaneous submission", "Reading period", "FNASR", "Revise and resubmit", "Blind judging", "Chapbook"],
    cta: "Open the glossary",
  },
};

/*
 * The library is a list of categories. To add a new section later (Glossary, Where to Submit,
 * Reading Shelf), append a category here; the page renders it with the same layout and adds it
 * to the section index automatically. Categories with no items are never rendered.
 */
export const RESOURCE_CATEGORIES: readonly ResourceCategory[] = [
  {
    id: "printable-tools",
    kicker: "Printable Tools",
    title: "Small tools for sending your work out.",
    intro:
      "Print them, fill them in by hand, or keep them open beside your submission form. Each one is a tidy US Letter page, and the cover letter also comes as an editable Word file.",
    items: [
      {
        id: "submission-tracker",
        slug: "atl-submission-tracker",
        title: "Submission Tracker",
        description: "A one-page, print-and-fill log of what you sent, where it went, and what came back.",
        pages: "1 page, landscape",
        orientation: "landscape",
        alt: "The Submission Tracker: a landscape table with columns for title, venue, genre, dates, fee, status, and notes",
        files: [{ label: "PDF", href: "/resources/atl-submission-tracker.pdf", size: "PDF" }],
      },
      {
        id: "cover-letter-template",
        slug: "atl-cover-letter-template",
        title: "Cover Letter Template",
        description: "A fill-in letter with a short guidance sidebar and a worked example.",
        pages: "2 pages, portrait",
        orientation: "portrait",
        alt: "The Cover Letter Template: a fill-in letter with bracketed prompts beside a guidance sidebar",
        files: [
          { label: "PDF", href: "/resources/atl-cover-letter-template.pdf", size: "PDF" },
          { label: "Word", href: "/resources/atl-cover-letter-template.docx", size: "DOCX" },
        ],
      },
      {
        id: "before-you-hit-submit",
        slug: "atl-before-you-hit-submit-checklist",
        title: "Before You Hit Submit",
        description: "A calm, final checklist for fit, guidelines, manuscript, letter, and follow-up.",
        pages: "1 page, portrait",
        orientation: "portrait",
        alt: "The Before You Hit Submit checklist: five groups of tick boxes and a notes panel",
        files: [{ label: "PDF", href: "/resources/atl-before-you-hit-submit-checklist.pdf", size: "PDF" }],
      },
    ],
  },
  GLOSSARY_CATEGORY,
];

export const RESOURCE_PRINCIPLES = [
  { title: "Free, with no sign-up", body: "Every file downloads directly. No email address, no account." },
  { title: "Made to be printed", body: "Clean US Letter pages that work in black and white." },
  { title: "Yours to use", body: "Print and copy them for your own writing as often as you like." },
] as const;
