export type ShopPreview = {
  slug: string;
  label: string;
  alt: string;
};

export type ShopGuide = {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  price: string;
  priceValue: string;
  url: string;
  cover: string;
  coverAlt: string;
  accent: string;
  format: string;
  summary: string;
  inside: readonly string[];
  previews: readonly ShopPreview[];
};

export const SHOP_IMAGE_BASE = "/images/shop";

export const SHOP_HIGHLIGHTS = [
  {
    title: "Instant PDF download",
    body: "Your files are ready the moment checkout is complete, with a download link sent to your email.",
  },
  {
    title: "Secure checkout through Payhip",
    body: "Payments are handled by Payhip, a platform built for digital products.",
  },
  {
    title: "Prices in Canadian dollars",
    body: "Every price on this page is listed in CAD.",
  },
] as const;

export const COMPLETE_SET = {
  id: "complete-set",
  title: "Among The Letters Writer's Guides: The Complete Set",
  shortTitle: "The Complete Set",
  price: "CA$8.99",
  priceValue: "8.99",
  separatePrice: "CA$9.98",
  savings: "CA$0.99",
  url: "https://payhip.com/b/qH6S8",
  cover: "complete-set",
  coverAlt:
    "Cover of Among The Letters Writer's Guides: The Complete Set, showing The Opportunity Map and The Submission Desk side by side",
  summary:
    "Both guides in one purchase. Use The Opportunity Map to find, judge, and choose the right places for your writing, then turn to The Submission Desk to prepare, send, and track every piece with confidence. Together they cover the whole path from first search to signed contract.",
  includes: [
    { title: "The Opportunity Map", detail: "71-page PDF" },
    { title: "The Submission Desk", detail: "68-page PDF" },
    { title: "Submission tracker spreadsheet", detail: "Excel and CSV" },
  ],
} as const;

export const GUIDES: readonly ShopGuide[] = [
  {
    id: "opportunity-map",
    number: "Guide No. 1",
    title: "The Opportunity Map",
    subtitle: "How to find, judge, and choose the right places for your writing",
    price: "CA$4.99",
    priceValue: "4.99",
    url: "https://payhip.com/b/euVa3",
    cover: "opportunity-map",
    coverAlt:
      "Cover of The Opportunity Map: How to find, judge, and choose the right places for your writing, Among The Letters Writer's Guides No. 1",
    accent: "#6aa84f",
    format: "71-page PDF",
    summary:
      "Good opportunities are scattered across magazines, contests, grants, residencies, and open calls that rarely share a home. The Opportunity Map teaches you how to find them anywhere, judge whether an offer is legitimate and worth your time, and build a submission list that truly fits your work.",
    inside: [
      "Six printable worksheets to sort what you have and what you want",
      "Canadian and international opportunities, with a dedicated Canadian chapter",
      "How to judge legitimacy and avoid predatory offers and fee traps",
      "A red flag checklist to keep beside you",
      "A method for building a well-matched submission list",
      "A resource directory and a glossary",
    ],
    previews: [
      {
        slug: "opportunity-map-p08-chapter-opener",
        label: "Chapter opener",
        alt: "Sample page from The Opportunity Map: the opening of Chapter 1, Know What You Have and What You Want, with an In this chapter summary",
      },
      {
        slug: "opportunity-map-p37-callouts",
        label: "Contest warning signs",
        alt: "Sample page from The Opportunity Map: a Good to know note on self-publishing, a list of contest warning signs, and a tip box",
      },
      {
        slug: "opportunity-map-p54-worksheet",
        label: "Printable worksheet",
        alt: "Sample page from The Opportunity Map: Worksheet 3, Grant and Residency Readiness Check, with fill-in fields and a requirements table",
      },
    ],
  },
  {
    id: "submission-desk",
    number: "Guide No. 2",
    title: "The Submission Desk",
    subtitle: "How to prepare, send, and track your writing with confidence",
    price: "CA$4.99",
    priceValue: "4.99",
    url: "https://payhip.com/b/w5ih1",
    cover: "submission-desk",
    coverAlt:
      "Cover of The Submission Desk: How to prepare, send, and track your writing with confidence, Among The Letters Writer's Guides No. 2",
    accent: "#3c78d8",
    format: "68-page PDF plus tracker spreadsheet",
    summary:
      "Once you know where to send your work, the details decide how it lands. The Submission Desk walks you through reading guidelines, formatting a manuscript, writing cover letters and bios, and keeping every submission organized, from the first send to the final contract.",
    inside: [
      "Reading guidelines, standard manuscript format, cover letters, and bios",
      "Simultaneous submissions, tracking, response times, and follow-ups",
      "Rejection, acceptance, rights (FNASR, reprint, electronic), and contract basics",
      "A primer on querying literary agents, plus submission etiquette",
      "Twelve copy-ready templates and a pre-submit checklist",
      "A submission tracker spreadsheet in Excel and CSV",
    ],
    previews: [
      {
        slug: "submission-desk-p14-sample-page",
        label: "Manuscript format",
        alt: "Sample page from The Submission Desk: an annotated sample first page in standard manuscript format",
      },
      {
        slug: "submission-desk-p26-callouts",
        label: "Pacing your submissions",
        alt: "Sample page from The Submission Desk: a sensible pacing strategy for simultaneous submissions, with a red flag note and takeaways",
      },
      {
        slug: "submission-desk-p58-template",
        label: "Copy-ready template",
        alt: "Sample page from The Submission Desk: Template A6, Bio Builder, with fill-in prompts and bios at three lengths",
      },
    ],
  },
] as const;

export const SHOP_FAQ = [
  {
    q: "How do I get my guide after I buy it?",
    a: "Checkout happens on Payhip. As soon as your payment goes through, you can download your files right away, and Payhip also emails you a download link so you can return to it later.",
  },
  {
    q: "What format are the guides?",
    a: "Each guide is a PDF sized for US Letter paper, with a clickable table of contents and working links. It reads well on a computer or tablet and prints cleanly at home. The Submission Desk and The Complete Set also include the submission tracker as an Excel file and a CSV file, which open in Excel, Google Sheets, Numbers, and most other spreadsheet apps.",
  },
  {
    q: "Can I print the worksheets and templates?",
    a: "Yes. You are welcome to print the worksheets, checklists, and templates as often as you like for your own personal use. Please do not share or resell the files.",
  },
  {
    q: "Are the guides only about Among The Letters listings?",
    a: "No. Both guides are standalone and teach skills you can use anywhere, whether you find an opportunity in a newsletter, on a magazine's website, or through a friend.",
  },
  {
    q: "Which currency are the prices in?",
    a: "All prices are in Canadian dollars (CAD). If your card uses another currency, your card provider handles the conversion.",
  },
  {
    q: "Is checkout secure?",
    a: "Yes. Payments are handled by Payhip, with card payments processed by Stripe. Among The Letters never sees or stores your card details.",
  },
  {
    q: "Can I get a refund?",
    a: "Because the guides are digital downloads, all sales are final and non-refundable. If anything goes wrong with your download, such as a file that will not open or a link that does not work, email amongtheletters@gmail.com with your order details and we will fix it.",
  },
] as const;
