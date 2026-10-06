export type ArchiveIssue = {
  slug: string;
  edition: "Morning Opportunities" | "Afternoon Discoveries" | "Weekly Discoveries Roundup";
  date: string;
  pdf: string;
};

// Explicit public archive. Afternoon Discoveries only — never list Morning Opportunities or Sunday Roundup.
export const ARCHIVE_ISSUES: ArchiveIssue[] = [
  {
    slug: "afternoon-discoveries-2026-10-06",
    edition: "Afternoon Discoveries",
    date: "2026-10-06",
    pdf: "/newsletters/afternoon-discoveries-2026-10-06.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-10-05",
    edition: "Afternoon Discoveries",
    date: "2026-10-05",
    pdf: "/newsletters/afternoon-discoveries-2026-10-05.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-10-04",
    edition: "Afternoon Discoveries",
    date: "2026-10-04",
    pdf: "/newsletters/afternoon-discoveries-2026-10-04.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-10-03",
    edition: "Afternoon Discoveries",
    date: "2026-10-03",
    pdf: "/newsletters/afternoon-discoveries-2026-10-03.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-10-02",
    edition: "Afternoon Discoveries",
    date: "2026-10-02",
    pdf: "/newsletters/afternoon-discoveries-2026-10-02.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-10-01",
    edition: "Afternoon Discoveries",
    date: "2026-10-01",
    pdf: "/newsletters/afternoon-discoveries-2026-10-01.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-30",
    edition: "Afternoon Discoveries",
    date: "2026-09-30",
    pdf: "/newsletters/afternoon-discoveries-2026-09-30.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-29",
    edition: "Afternoon Discoveries",
    date: "2026-09-29",
    pdf: "/newsletters/afternoon-discoveries-2026-09-29.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-28",
    edition: "Afternoon Discoveries",
    date: "2026-09-28",
    pdf: "/newsletters/afternoon-discoveries-2026-09-28.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-27",
    edition: "Afternoon Discoveries",
    date: "2026-09-27",
    pdf: "/newsletters/afternoon-discoveries-2026-09-27.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-26",
    edition: "Afternoon Discoveries",
    date: "2026-09-26",
    pdf: "/newsletters/afternoon-discoveries-2026-09-26.pdf",
  },
  {
    slug: "afternoon-discoveries-2026-09-25",
    edition: "Afternoon Discoveries",
    date: "2026-09-25",
    pdf: "/newsletters/afternoon-discoveries-2026-09-25.pdf",
  },
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
  }
];

export const EDITION_DESCRIPTIONS: Record<ArchiveIssue["edition"], string> = {
  "Morning Opportunities":
    "Writing work, contests, grants, residencies, calls for submissions, and other useful places to send your work.",
  "Afternoon Discoveries":
    "Books, authors, essays, stories, poems, publications, and literary work worth finding.",
  "Weekly Discoveries Roundup":
    "A Sunday evening catch-up that gathers the week's discoveries after the regular Sunday Afternoon Discoveries edition.",
};
