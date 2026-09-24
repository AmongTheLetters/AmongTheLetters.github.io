export type ArchiveIssue = {
  slug: string;
  edition: "Morning Opportunities" | "Afternoon Discoveries" | "Weekly Discoveries Roundup";
  date: string;
  pdf: string;
};

// The archive is intentionally explicit instead of auto-publishing every PDF
// placed in the repository. Add an issue here only when you want its PDF to be
// publicly accessible from the website.
export const ARCHIVE_ISSUES: ArchiveIssue[] = [
  {
    slug: "afternoon-discoveries-2026-09-24",
    edition: "Afternoon Discoveries",
    date: "2026-09-24",
    pdf: "/newsletters/afternoon-discoveries-2026-09-24.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-23",
    edition: "Afternoon Discoveries",
    date: "2026-09-23",
    pdf: "/newsletters/afternoon-discoveries-2026-09-23.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-22",
    edition: "Afternoon Discoveries",
    date: "2026-09-22",
    pdf: "/newsletters/afternoon-discoveries-2026-09-22.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-21",
    edition: "Afternoon Discoveries",
    date: "2026-09-21",
    pdf: "/newsletters/afternoon-discoveries-2026-09-21.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-20",
    edition: "Afternoon Discoveries",
    date: "2026-09-20",
    pdf: "/newsletters/afternoon-discoveries-2026-09-20.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-19",
    edition: "Afternoon Discoveries",
    date: "2026-09-19",
    pdf: "/newsletters/afternoon-discoveries-2026-09-19.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-18",
    edition: "Afternoon Discoveries",
    date: "2026-09-18",
    pdf: "/newsletters/afternoon-discoveries-2026-09-18.pdf",
  },
];

export const EDITION_DESCRIPTIONS: Record<ArchiveIssue["edition"], string> = {
  "Morning Opportunities":
    "Writing work, contests, grants, residencies, calls for submissions, and other useful places to send your work.",
  "Afternoon Discoveries":
    "Books, authors, essays, stories, poems, publications, and literary work worth finding.",
  "Weekly Discoveries Roundup":
    "A Sunday evening catch-up that gathers the week's discoveries after the regular Sunday Afternoon Discoveries edition.",
};
