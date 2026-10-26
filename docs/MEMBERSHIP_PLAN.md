# Opportunities database and memberships, the plan

Branch `opportunities-db`. Built and ready to switch on, nothing deployed, no accounts created and no payments set up.
Step-by-step setup lives in [`LAUNCH_CHECKLIST.md`](../LAUNCH_CHECKLIST.md).

## Decisions
- Price CA$7 a month or CA$70 a year. Membership includes a comped paid Substack subscription.
- Account and alert emails go through a free Brevo account. Brevo's free plan is free with no end date, up to 300 emails a day across everything it sends.
- People who already pay on Substack get the database at no extra cost, through an allowlist from the Substack subscriber export, matched by email.
- Substack comps are done by hand in the Substack dashboard from a to-do list on the account page and a daily email.
- The database is in the site menu from launch. Until the accounts exist, the page shows the free list with "Memberships open soon".
- On-site notifications are the main alert channel. Email and browser push are opt-in.

## How it fits together
| Piece | Tool | Cost |
| --- | --- | --- |
| Website | GitHub Pages, as now | Free |
| Accounts | Supabase Auth, email and password plus email sign-in link. Google sign-in is built but off | Free up to 50,000 monthly active users |
| Members-only data, saved searches, notifications | Supabase Postgres with row-level security | Free, 500 MB |
| Payment | Two Stripe Payment Links on the existing Minocy account, plus the Stripe customer portal | No monthly fee, about 2.9% plus 30 cents a charge |
| Glue | Supabase Edge Functions `stripe-webhook`, `alerts`, `calendar-feed` | Free, 500,000 calls a month |
| Emails | Brevo SMTP for account emails, Brevo API for opt-in alerts and the Substack to-do digest | Free, 300 a day |
| Browser push (optional) | Web Push with VAPID keys, no third party | Free |

### Site modes, chosen at build time
- `off` when no Supabase settings are present. Free listings and RSS only, sign-in hidden. Safe to merge any time.
- `live` when `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set as repository Variables.
- `preview` with `VITE_PREVIEW=1`, review builds only. Pretend accounts in the browser and a switcher bar. Add `?as=member` (or visitor, free, canceling, substack) to a page address to open it in that state.

### Sign-up and payment
1. A reader creates an account on `/account/` and confirms the email (required).
2. If the email is on the Substack allowlist, everything opens straight away.
3. Otherwise the plan picker opens the Stripe Payment Link with `client_reference_id` (the account id) and the account email locked.
4. Stripe sends `checkout.session.completed`. The webhook marks the membership active and queues a Substack comp, unless the person already pays on Substack.
5. Row-level security now returns every listing to that account.

### What is secure
- Members-only listings live only in Supabase and are released by row-level security. The public anon key cannot read them. The allowlist and admin checks use the confirmed email from the auth table, not anything the browser sends.
- Stripe webhooks are verified with the signing secret. The alerts function checks a shared cron secret.
- Secrets live only in Supabase. The repo holds public values only. The plaintext listings file stays on the box, the public repo gets the free list and RSS.
- No site can stop a paying member copying listings. That is true of every paid newsletter.

## Notifications
| Kind | When | Where |
| --- | --- | --- |
| New match | A new listing matches a saved search (checked hourly) | Bell on the site. Email if the member turned email on for that search, as it happens, daily digest or weekly digest |
| Closing soon | A followed listing closes within the member's lead time (3, 7, 10 or 14 days) | Bell. Email if email alerts are on |
| Closes today | A followed listing closes today | Bell. Email if email alerts are on |

- Every notification links straight to its listing (`/opportunities/?o=<id>`), plus the saved search when there is one (`&s=<search id>`). The page opens the listing, scrolls to it and highlights it with "From your notification".
- The bell in the header shows an unread count, the latest notifications, mark all read, and a link to alert settings.
- Alert settings on the account page. On-site is always on. Email is a master switch, off by default. Per saved search, on-site on or off, email on or off, and frequency. Closing reminder lead time. Browser notifications on or off for this device. A private calendar link of followed listings.
- Notifications are created only on the server, in the `notifications` table. Members can read their own and mark them read, nothing else.
- Daily and weekly digests go out at 9 a.m. Toronto time, weekly on Mondays. Closing reminders by email go out the hour they are created.
- Email budget. 300 a day covers account emails plus alerts for roughly 150 to 250 members on daily or instant email, and far more on weekly digests. The bell has no limit.

## The Substack step
Substack has no public API for comps, so this stays a short manual task.
- On payment the webhook queues `comp`. Monthly members are comped forever and removed when the membership ends. Yearly members get 1 year, extended at each renewal.
- When a membership ends (after a cancel or failed payments), the webhook queues `remove`.
- The account page shows the to-do list to admins, with a Done button. The `alerts` function also emails the list to `ADMIN_EMAIL` at 9 a.m. Toronto time when there is something to do.
- In Substack, Subscribers, find the email, three-dot menu, Comp (or Remove comp).
- People on the allowlist are never queued, they already pay on Substack.

## The allowlist
- Monthly, export subscribers from Substack and run `scripts/import-substack-allowlist.mjs`. Paid, founding and gift subscribers are kept. Comps are skipped, because comps are the website's own members.
- Anyone who stops paying on Substack is switched off at the next import. Their account stays, as a free account.

## Pricing
CA$7 a month or CA$70 a year (two months free). About 47 net members bring in about CA$300 a month after Stripe fees.
Free accounts and visitors see the free half of the list, filters, follows saved in the browser, one-off calendar reminders and RSS. Locked cards show type, region, genres and deadline month only.

## Data source and refresh
- Source of truth is the private list at `/workspace/atl-project/opportunities/opportunities.json`, never committed.
- After each Monday Morning Opportunities run, update the list, then run `scripts/sync-opportunities.mjs` (Supabase) and `scripts/build-opportunities.mjs` (free list and RSS for the repo).
- Listings drop off the day after their deadline. Rolling listings are re-verified every 30 days.

Fields `id, title, org, type, genres[], region, location, eligibility, opens, deadline, deadline_note, fee (Free | Fee | Check), award, summary, url, verified, added, tier`.

## Free resource library ideas
1. Submission tracker app with response times and CSV export.
2. Word count and format checker against common limits.
3. Cover letter builder on the existing template.
4. Contest fee calculator.
5. Interactive Before You Hit Submit checklist.
6. Market match quiz pointing to free listings.
