# Opportunities database and memberships, plan (draft for Chris)

Branch `opportunities-db`. Nothing here is live, no accounts were created and no payments were set up.

## 1. How it fits together

| Piece | Tool | Cost | Why |
| --- | --- | --- | --- |
| Website | GitHub Pages, as now | Free | Stays static. |
| Accounts | Supabase Auth (email and password, email sign-in link, optional Google) | Free up to 50,000 monthly active users | Real accounts with no server to run. |
| Members-only data | Supabase Postgres with row-level security | Free, 500 MB | The database itself refuses members-only rows to anyone without an active membership. |
| Payment | Stripe Payment Links on the existing Minocy Stripe account, plus the Stripe customer portal | No monthly fee. Stripe takes about 2.9% plus 30 cents a charge | Signed webhooks, renewal dates, self-serve cancel, receipts. |
| Glue | One Supabase Edge Function (`supabase/functions/stripe-webhook`) | Free, 500,000 calls a month | Turns Stripe events into membership rows and Substack tasks. |
| Account emails | Custom SMTP, either Gmail SMTP from amongtheletters@gmail.com (free, needs an app password) or Brevo free (300 a day, new account) | Free | Supabase's built-in mailer only sends to team members, 2 an hour. |
| Alerts | Substack (Monday email), scheduled Edge Function for saved-search emails, private calendar feed, public RSS | Free | See section 4. |

Cloudflare Workers would also work for the webhook, but Supabase Edge Functions avoid a second account.

### Sign-up and payment flow
1. Reader creates an account on `/account/`.
2. "Continue to secure checkout" opens the Stripe Payment Link with `client_reference_id=<user id>` and `locked_prefilled_email=<account email>`.
3. Stripe sends `checkout.session.completed`. The webhook writes `members` (active, plan, period end) and adds a `comp` row to `substack_queue`.
4. The database page now returns every row for that user. The account page shows the membership and the Substack step.

### What is truly secure
- Secure. Members-only listings live only in Supabase and are released by row-level security after Stripe confirms payment. The public anon key cannot read them. Webhooks are verified with Stripe's signing secret.
- Not secure on any site. A paying member can copy listings and share them. That is the same for every paid newsletter.
- The preview on this branch is not the security model. It uses pretend accounts in the browser and an encrypted file opened with a published demo key. The encrypted file approach (a monthly code, AES-GCM) is a workable fallback if Chris wants a code instead of accounts, but sharing a code is honour-system.

## 2. The Substack step
Substack has no public API for adding paid subscribers, so this is a short manual task, helped by the queue.
- On payment, the webhook queues `comp` for the member's email.
- Daily (or each weekday morning), a routine reads the queue and either does the comps in the Substack dashboard (Subscribers, select the email, three-dot menu, Comp) with Chris's existing Substack login on the box, or sends Chris a one-line list to do in about a minute.
- Comp lengths Substack offers are 7 days, 30 days, 90 days, 6 months, 1 year or forever.
  - Monthly members get "forever" and are removed when they cancel. This avoids monthly busywork.
  - Yearly members get 1 year, extended at each renewal. A missed removal lapses by itself.
- Cancellation. The member cancels in the Stripe portal. Stripe keeps them active to the period end (shown as "Ends soon" on the account page). At the end, Stripe sends `customer.subscription.deleted`, the webhook sets the membership to expired and queues `remove`. The routine removes the comp.
- Failed payments. Stripe retries for about two weeks (status `past_due`, access kept). If retries fail, it ends the subscription and the removal follows.
- Monthly reconciliation. Export the Substack subscriber CSV and compare comps with active members, so nothing drifts.
- Edge case. If a member already pays on Substack, do not comp them. Offer a refund of one side or a credit instead.

## 3. Pricing in CAD
Membership includes a paid Substack subscription (currently US$5 a month or US$50 a year, about CA$7 or CA$70). The website price should not undercut Substack.

| Option | Monthly | Yearly | Members needed for about CA$300 a month after Stripe fees |
| --- | --- | --- | --- |
| A. Recommended | CA$8 | CA$80 | about 41 monthly, or about 47 yearly |
| B. Match Substack | CA$7 | CA$70 | about 47 monthly |
| C. Premium | CA$10 | CA$100 | about 32 monthly |

Free tier: a free account sees the listings from the free half of each Monday email, plus filters, bookmarks, one-off calendar reminders and RSS. Visitors see the same free listings and locked cards for the rest (type, region, genres and deadline month only).

Existing paid Substack subscribers could get the database as a thank you. They sign up with the same email, and a monthly check against the Substack paid list marks them as members.

## 4. Alerts
- Monday email. Members get the full paid Morning Opportunities through their Substack comp. Free, no new tools.
- Saved search emails. A scheduled Edge Function (Supabase cron) emails members when a new listing matches their saved search, through the same SMTP as account emails. Gmail allows about 500 a day.
- Closing soon note. Same function, Thursdays, saved listings that close within ten days.
- Private calendar feed. `webcal://` link per member (token in `alert_prefs`) served by an Edge Function. Works in Google, Apple and Outlook calendars and needs no email at all.
- Public RSS of free listings at `/opportunities/feed.xml` (built on this branch).
MailerLite free (250 subscribers, no RSS campaigns) and Buttondown free (100 subscribers, RSS is a paid add-on) are too small to be the main channel.

## 5. Data source and refresh
- Source of truth is the private list at `/workspace/atl-project/opportunities/opportunities.json`, never committed to the public repo.
- Each Monday Morning Opportunities run already verifies about 40 listings. After QA, its manifest feeds the list. Listings from the free half are `tier: free`, everything else is `members`.
- Weekly link check (status code plus a deadline text check on each official page). Listings drop off the day after their deadline. Rolling listings are re-verified every 30 days.
- A small sync script pushes the list into the Supabase table with the service key, kept only on the box.

### Fields
`id, title, org, type, genres[], region, location, eligibility, opens, deadline, deadline_note, fee (Free | Fee | Check), award, summary, url, verified, added, tier`

Types are Contest, Call for submissions, Grant, Residency, Fellowship, Mentorship, Paid market and Job.

### Filters on the page
Type chips with counts, search, deadline window (7, 30 or 90 days, or rolling), region, genre, free to enter, saved only, and sort by deadline, newest or name. It also shows a countdown badge, a "New" flag since the last visit, a per-listing calendar reminder (.ics, one-week alarm) and an export of every filtered deadline.

## 6. Steps that need a new account, ID or money
| Step | New account | Photo ID | Money |
| --- | --- | --- | --- |
| Supabase project | Yes, free (sign in with the ATL GitHub or Google account) | No | No |
| Stripe products, Payment Links, customer portal, webhook | No, existing Minocy Stripe | No, already verified. A brand new ATL Stripe account would need ID, so it is not proposed | Stripe fees only, taken from each payment |
| Statement descriptor and public business name | No | Changing the business name can prompt Stripe to re-check details | No |
| Account email sending | Gmail app password (needs 2-Step Verification on the ATL Gmail) or a free Brevo account | No | No |
| Substack comps | No | No | No |
| Keep the free Supabase project awake (it pauses after a week without activity) | No, a weekly GitHub Actions ping | No | No |
| Google sign-in (optional) | Google Cloud project, free | No | No |

## 7. Free resource library
Today `/resources/` has three printables (Submission Tracker PDF, Cover Letter Template PDF and Word, Before You Hit Submit checklist PDF) and the Plain-Language Glossary (70 terms, 5 topics, searchable).

Proposed interactive additions, all client-side and free:
1. Submission tracker app. Log submissions in the browser, see response times and acceptance rate, export to CSV.
2. Word count and format checker. Paste a piece and see words, lines and reading time against common limits (100, 500, 750, 1,000, 3,000 words, poem line limits).
3. Cover letter builder. Fill in a short form and copy or download a tidy letter, built on the existing template.
4. Contest fee calculator. Compare entry fee, prize, included subscription and odds, so writers can judge value.
5. Interactive Before You Hit Submit. The checklist with tick boxes that remembers progress per submission.
6. Market match quiz. Genre, length and fee preferences point to matching free listings, with the rest teased for members.
