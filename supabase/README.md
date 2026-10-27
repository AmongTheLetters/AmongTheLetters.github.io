# Membership backend (ready to deploy, not deployed)

The website stays a static GitHub Pages site. Supabase handles accounts, members-only listings and notifications.
Stripe handles payment, Brevo sends account and alert emails. Step-by-step setup is in `LAUNCH_CHECKLIST.md`
at the repo root, the reasoning is in `docs/MEMBERSHIP_PLAN.md`.

| Path | What it does |
| --- | --- |
| `migrations/20261026000100_membership.sql` | Tables, row-level security, the Substack allowlist, notifications, helper functions |
| `migrations/20261026000200_schedule.sql` | Hourly pg_cron job that calls the `alerts` function |
| `functions/stripe-webhook/` | Keeps `members` in sync with Stripe and queues Substack comps |
| `functions/alerts/` | Creates on-site notifications, sends opt-in push and email, and the Substack to-do digest |
| `functions/calendar-feed/` | Private calendar subscription of followed listings |
| `functions/link-check/` | Monthly check of every listing's official page, hides listings dead twice in a row |
| `functions/_shared/opportunities.ts` | Copy of the site's filter matcher, refresh with `node scripts/sync-shared.mjs` |

Scripts (run from the repo root, keys only in the environment)

- `scripts/sync-opportunities.mjs` pushes the private listings file into the `opportunities` table.
- `scripts/import-substack-allowlist.mjs` refreshes the list of paying Substack subscribers from the CSV export.
- `scripts/build-opportunities.mjs` writes the public free list and RSS. `OPP_PREVIEW=1` adds the review-only encrypted file.
  `OPP_FROM_SUPABASE=1` reads the database instead of the private file, which is what the daily GitHub Action does.
- The once-a-year review lives in [`docs/ANNUAL_REVIEW.md`](../docs/ANNUAL_REVIEW.md).

The anon key that ships in the site is public by design, security comes from row-level security. The service role key,
Stripe keys, Brevo keys, CRON_SECRET and the VAPID private key live only in Supabase secrets and never in this repo.
