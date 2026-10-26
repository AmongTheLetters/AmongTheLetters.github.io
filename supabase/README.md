# Membership backend (draft, not deployed)

The website stays a static GitHub Pages site. Supabase handles accounts and the members-only data,
Stripe handles payment, and one Edge Function connects them. See `docs/MEMBERSHIP_PLAN.md`.

- `schema.sql` creates the tables and row-level security policies.
- `functions/stripe-webhook/` keeps memberships in sync with Stripe and queues Substack comps.
- `src/lib/auth.ts` on this branch is a pretend layer for the preview. At launch it becomes a
  wrapper around `@supabase/supabase-js` with the same functions.

The anon key that ships in the site is public by design. Security comes from row-level security.
The service role key, Stripe secret key and webhook secret live only in Supabase secrets.
