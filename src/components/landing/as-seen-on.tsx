/*
 * "As seen on" strip for the homepage.
 * To add a listing or feature, append one entry to AS_SEEN_ON below.
 * Entries with `badge` render as an image, otherwise as a text link.
 * Only add links that are confirmed live.
 */
type AsSeenOnEntry = {
  name: string;
  href: string;
  badge?: { src: string; alt: string; width: number; height: number };
};

export const AS_SEEN_ON: AsSeenOnEntry[] = [
  {
    name: "InboxReads",
    href: "https://inboxreads.co/n/among-the-letters?referrer=829WF7N&source=badge&utm_source=badge&utm_medium=badge",
    badge: {
      src: "https://api.inboxreads.co/analytics/badge.png?newsletter=among-the-letters",
      alt: "Among The Letters on InboxReads",
      width: 210,
      height: 54,
    },
  },
  {
    name: "BlogHub",
    href: "https://bloghub.app/publications/among-the-letters-7dde36fa",
    // Self-hosted badge built from BlogHub's own BH mark (bloghub.app/assets/Bloghub-logo.png) and red wordmark,
    // in the same size and shape as the InboxReads badge. BlogHub does not publish an official badge.
    badge: {
      src: "/images/as-seen-on/bloghub-badge.png",
      alt: "BlogHub",
      width: 210,
      height: 54,
    },
  },
];

export function AsSeenOn() {
  if (AS_SEEN_ON.length === 0) return null;
  return (
    <section aria-labelledby="as-seen-on-heading" className="border-t border-rule py-12">
      <div className="section-shell flex flex-col items-center gap-6 text-center">
        <h2 id="as-seen-on-heading" className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          As seen on
        </h2>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          {AS_SEEN_ON.map((entry) => (
            <li key={entry.name}>
              <a
                href={entry.href}
                target="_blank"
                rel="noopener"
                className="inline-block text-sm text-muted transition-colors hover:text-ink"
              >
                {entry.badge ? (
                  <img
                    src={entry.badge.src}
                    alt={entry.badge.alt}
                    width={entry.badge.width}
                    height={entry.badge.height}
                    loading="lazy"
                    className="h-auto max-w-full"
                  />
                ) : (
                  entry.name
                )}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
