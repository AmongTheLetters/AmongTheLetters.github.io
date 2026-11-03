/**
 * First-visit welcome popup (the flier shown once to signed-out visitors).
 *
 * To turn it back on, set SHOW_WELCOME_POPUP to true and push to main.
 * To show something new, swap the image in public/images/ and update
 * WELCOME_POPUP.image, width, height and alt below. Change storageKey too
 * (for example "atl-flier-dismissed-2") so readers who closed the old
 * popup see the new one once.
 *
 * The component lives in src/components/landing/flier-popup.tsx and is
 * still mounted on every page, so nothing else needs to change.
 */
export const SHOW_WELCOME_POPUP = false;

export const WELCOME_POPUP = {
  storageKey: "atl-flier-dismissed",
  image: "/images/atl-flier.webp",
  width: 1025,
  height: 1535,
  title: "Among The Letters flier",
  alt: "Among The Letters flier: an Afternoon issue every day with new books, authors, short stories, essays, and poems, a Monday Morning issue of writing opportunities, and a QR code to subscribe free on Substack.",
};
