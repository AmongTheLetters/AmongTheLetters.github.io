# Opportunities database, the once-a-year review

The database is built to run untouched for a year. This is the one sitting that keeps it honest.
Set aside an afternoon each October, before the winter deadline season.

## What runs by itself

| What | When | Where |
|---|---|---|
| Site rebuild with fresh dates, free list and RSS | Daily, 6:15 a.m. Toronto | `.github/workflows/deploy-pages.yml` |
| Saved refresh commit that keeps the schedule alive | When the list changes, and on the 1st of every month | same workflow |
| Link check of every official page | Monthly, the 3rd at 06:23 UTC | `supabase/functions/link-check`, pg_cron job `atl-link-check-monthly` |
| Alerts and closing reminders, real dates only | Hourly | `supabase/functions/alerts` |

The page applies the upkeep rules on every visit.

- **Rolling** listings never expire.
- **One-time** listings hide the day after their deadline.
- **Annual** listings stay up after their deadline and show "Next deadline expected around Month Year", using `typicalCloseMonth` (or the last deadline's month). They lose the countdown, the calendar button and closing reminders until real dates are added.
- A listing whose page answers 404, 410 or no longer resolves for **two monthly checks in a row** is hidden by row-level security. One good check brings it back. Blocked or busy answers (403, 429, 5xx, timeouts) change nothing.

## The checklist

1. **Back up** `/workspace/atl-project/opportunities/opportunities.json` as `_bak_opportunities_YYYY-MM-DD.json`.
2. **Dead or hidden links.** Run this in the Supabase SQL editor and fix or remove each row in the file.
   `select id, url, link_status, link_fail_count, link_checked_at from opportunities where link_status <> 'ok' order by link_fail_count desc;`
3. **Roll annual listings forward.** For every annual listing showing an expected month, open the official page and set the new `opens`, `deadline`, `deadlineNote`, `fee`, `feeAmount` and `award`. Update `verified` and `lastChecked`. If the program has ended, delete it.
4. **Rolling markets.** Confirm each paying market still pays and still reads submissions. Update `payRate`. Remove any that closed for good.
5. **One-time listings.** Past ones are already hidden, so delete them from the file.
6. **Tiers.** Anything now easy to find with a simple search (Canada Council, NEA, big-name prizes and famous residencies) is `tier: "free"`. Harder-to-find listings (small regional residencies, quiet open calls, lesser-known paying markets, niche grants) are `members`. Aim for 35 to 40% free, with findability winning over the ratio.
7. **Never jobs.** Reading and writing opportunities only. The database refuses any type outside Contest, Prize, Call for submissions, Grant, Residency, Fellowship, Mentorship, Paid market and Reading program.
8. **Add new listings** from the free sources (Monday Morning research, arts councils, Poets & Writers listings, Submission Grinder, CLMP, Alliance of Artists Communities and the magazines' own guideline pages). Skip duplicates by URL or by title plus org. Prefer annual and rolling listings over one-offs. Never pay for a source.
9. **Push it.** From the repo root, with keys only in the environment.
   `node scripts/sync-opportunities.mjs` then `node scripts/build-opportunities.mjs`, then commit and push. The daily workflow takes it from there.
10. **Spot check** `/opportunities/` signed out, signed in free and as a member.

## Field guide (file keys are camelCase)

`recurrence` annual, rolling or one-time. `typicalOpenMonth` and `typicalCloseMonth` 1 to 12, annual only.
`paysWriter` true when the writer is paid for accepted work or receives money for taking part (paying markets, grants, fellowships and residencies with stipends). Prize money alone does not count. `payRate` short text.
`fee` Free, Fee or Check, plus `feeAmount` and `feeCurrency` (CAD, USD, GBP, EUR, AUD) when known.
`source` where the listing came from. `lastChecked` the date the official page was last read.
`link_status`, `link_fail_count` and `link_checked_at` belong to the link check. The sync never sends them.
