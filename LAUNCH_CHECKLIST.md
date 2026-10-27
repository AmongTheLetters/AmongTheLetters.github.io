# Launch checklist, opportunities database and memberships

Everything in the repo is built. This list is the outside setup, in order. Sections marked **Done** are finished.

Markers
- **[browser]** done in a web dashboard while signed in
- **[secret]** creates or uses a private value. Paste it only where the step says (Supabase secrets, Stripe, Brevo). Never in chat, a commit, a screenshot or a repository Variable
- **[Chris]** needs Chris, a decision or a sign-in only Chris can do
- **[box]** a command run from the repo on the box

Values you collect along the way (write the public ones down, keep the secret ones in the password vault)

| Value | Public or secret | Goes to |
| --- | --- | --- |
| Supabase project URL `https://<ref>.supabase.co` | Public | Repo Variable `SUPABASE_URL`, Vault `project_url` |
| Supabase anon key (Settings, API keys, the `anon` / publishable key) | Public | Repo Variable `SUPABASE_ANON_KEY` |
| Supabase service role key | **Secret** | Only in the environment when running the two scripts. Edge Functions get it automatically |
| Supabase access token (for the CLI) | **Secret** | Only in the environment when deploying |
| Brevo SMTP login and SMTP key | **Secret** (the key) | Supabase, Authentication, SMTP |
| Brevo API key | **Secret** | Supabase function secret `BREVO_API_KEY` |
| Stripe secret key (restricted key recommended) | **Secret** | Supabase function secret `STRIPE_SECRET_KEY` |
| Stripe webhook signing secret `whsec_...` | **Secret** | Supabase function secret `STRIPE_WEBHOOK_SECRET` |
| Stripe Payment Link URLs, monthly, yearly and lifetime | Public | Repo Variables `STRIPE_LINK_MONTHLY`, `STRIPE_LINK_ANNUAL`, `STRIPE_LINK_LIFETIME` |
| Stripe customer portal login link | Public | Repo Variable `STRIPE_PORTAL` |
| `CRON_SECRET`, a long random string | **Secret** | Function secret `CRON_SECRET` and Vault `cron_secret`, the same value |
| VAPID public key (optional) | Public | Repo Variable `VAPID_PUBLIC_KEY`, function secret `VAPID_PUBLIC_KEY` |
| VAPID private key (optional) | **Secret** | Function secret `VAPID_PRIVATE_KEY` |

---

## A. Brevo, free email sending (about 20 minutes plus DNS wait)
The free plan has no end date. It allows 300 emails a day across account emails and alerts.

1. **[browser] [Chris]** Create a free Brevo account at brevo.com with amongtheletters@gmail.com. Pick the free plan and skip every upgrade offer. Brevo may ask for a company name and address to activate sending. Use *Among The Letters* and the mailing address Chris is comfortable showing in email footers.
2. **[browser]** Settings, Senders, Domains and dedicated IPs, Domains, Add a domain, `amongtheletters.com`. Choose "Authenticate the domain yourself". Brevo shows three or four records. Copy the values exactly from Brevo.
3. **[browser] [Chris]** In Cloudflare, `amongtheletters.com`, DNS, Records, add
   | Type | Name | Value | Proxy |
   | --- | --- | --- | --- |
   | TXT | `@` | `brevo-code:...` from Brevo | n/a |
   | CNAME | `brevo1._domainkey` | value from Brevo | **DNS only** (grey cloud) |
   | CNAME | `brevo2._domainkey` | value from Brevo | **DNS only** (grey cloud) |

   If Brevo shows one DKIM TXT record instead of two CNAMEs, add that TXT record instead.
   **Do not add a second DMARC record.** The domain already has `_dmarc` set to `v=DMARC1; p=reject; sp=reject; adkim=s; aspf=s`. Brevo's DKIM signs as amongtheletters.com, so mail passes that policy. Two DMARC records would break it. If Brevo insists on its own DMARC value, edit the existing record rather than adding one, and keep `p=reject`. Leave the existing `v=spf1 -all` TXT record alone, Brevo does not need SPF.
4. **[browser]** Back in Brevo, click "Authenticate this email domain". It can take up to 48 hours. Retry until it shows Authenticated.
5. **[browser]** Senders, Add a sender. Name *Among The Letters*, email `no-reply@amongtheletters.com`. Add a second one, `alerts@amongtheletters.com`. Senders on an authenticated domain are normally accepted without a code. If Brevo asks to send a code to that address, there is no inbox there yet. Turn on Cloudflare Email Routing (free) to forward those two addresses to amongtheletters@gmail.com, which adds MX records and an SPF include for Cloudflare, then retry.
6. **[browser] [secret]** Settings, SMTP and API, SMTP tab. Note the SMTP server `smtp-relay.brevo.com`, port `587`, and the login (looks like `xxxx@smtp-brevo.com`). Generate a new SMTP key named `supabase-auth`. This is the SMTP password. It is not the API key.
7. **[browser] [secret]** Same page, API keys tab. Generate an API key named `atl-alerts`.

## B. Supabase project (about 30 minutes)
1. **[browser] [Chris]** Sign in at supabase.com with the *Among The Letters* GitHub account and create an organisation on the Free plan. New project, name `among-the-letters`, region Canada (Central) if offered, otherwise US East. Generate a strong database password and save it in the password vault **[secret]**. Skip every paid add-on.
2. **[browser]** Settings, API keys. Note the project URL and anon key (public) and the service role key **[secret]**.
3. **[browser]** SQL Editor, New query. Paste all of `supabase/migrations/20261026000100_membership.sql` and run it. It should finish with no errors.
4. **[browser]** Database, Extensions. Make sure `pg_cron` and `pg_net` are enabled (the next migration also enables them).
5. **[browser] [secret]** SQL Editor, run, with the real values
   ```sql
   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
   select vault.create_secret('<CRON_SECRET>', 'cron_secret');
   ```
   Make the cron secret with `openssl rand -hex 32` on the box **[box]**, store it in the vault, and use the same value in step B11.
6. **[browser]** SQL Editor, paste and run `supabase/migrations/20261026000200_schedule.sql`. Integrations, Cron should then list `atl-alerts-hourly`.
7. **[browser]** SQL Editor, add the admin who sees the Substack to-do list, then confirm with Chris which address that is **[Chris]**
   ```sql
   insert into public.admins (email) values ('amongtheletters@gmail.com');
   ```
   The admin needs a website account with that email, confirmed, to see the list.
8. **[browser]** Authentication, URL Configuration. Site URL `https://amongtheletters.com`. Redirect URLs `https://amongtheletters.com/account/**` and `http://localhost:5173/**`.
9. **[browser]** Authentication, Sign In / Providers.
   - Email provider on. **Confirm email on** (the Substack allowlist depends on it). Secure email change on. Minimum password length 8.
   - Allow new users to sign up on. Anonymous sign-ins off.
   - Google off for now (the site hides the button unless `GOOGLE_SIGNIN` is `on`).
10. **[browser] [secret]** Authentication, Emails, SMTP Settings. Enable custom SMTP.
    - Sender email `no-reply@amongtheletters.com`, sender name `Among The Letters`
    - Host `smtp-relay.brevo.com`, port `587`
    - Username the Brevo SMTP login, password the Brevo SMTP key from A6
    Then Authentication, Rate Limits, set emails sent per hour to 60. Optional, edit the email templates (Confirm signup, Magic link, Reset password) to the *Among The Letters* voice, keeping `{{ .ConfirmationURL }}`.
11. **[browser] [secret]** Edge Functions, Secrets (or `supabase secrets set` in B12). Add
    - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (after section C)
    - `CRON_SECRET` (same as Vault)
    - `BREVO_API_KEY` (A7), `MAIL_FROM` = `alerts@amongtheletters.com`, `REPLY_TO` = `amongtheletters@gmail.com`
    - `ADMIN_EMAIL` = the address for the daily Substack to-do email
    - optional `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` = `mailto:amongtheletters@gmail.com` (section D)
    `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.
12. **[box] [secret]** Deploy the four functions. Create an access token at supabase.com, Account, Access Tokens, then from the repo
    ```bash
    export SUPABASE_ACCESS_TOKEN=...   # in the shell only
    npx supabase functions deploy stripe-webhook alerts calendar-feed founding-downloads --project-ref <ref>
    unset SUPABASE_ACCESS_TOKEN
    ```
    `supabase/config.toml` turns off the Supabase token check for the first three, because each checks its own secret. `founding-downloads` keeps it on. Revoke the access token afterwards if you like.
13. **[box] [secret]** Load the listings
    ```bash
    SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-opportunities.mjs
    ```
    It should report 25 listings, 12 free (or the current numbers).

## C. Stripe on the Minocy account, **Done** (Oct 27, 2026)
Live mode, account `acct_1Skr9CRrwe7mDXay` (Minocy). Checkout currently shows the account's public business name, which Chris can change in Stripe's public business details. The same IDs are in `.stripe-ids.local` (gitignored).

| Item | Value |
| --- | --- |
| Product, monthly and yearly | `prod_VWDyQ99rRmLCEJ` *Among The Letters membership* |
| Price, monthly CA$7.00 | `price_1UVBWLRrwe7mDXayn7Sgk9cm` |
| Price, yearly CA$70.00 | `price_1UVBWLRrwe7mDXayXZwQBde2` |
| Payment Link, monthly | `plink_1UVBYSRrwe7mDXayjinKpdaZ` https://buy.stripe.com/3cI5kFdwdb4N3bIe534ow00 |
| Payment Link, yearly | `plink_1UVBZbRrwe7mDXaytwpYEDCr` https://buy.stripe.com/14AeVfak1egZh2y8KJ4ow01 |
| Product, lifetime | `prod_VWEQMwnRTu0ae2` |
| Price, lifetime CA$299.00 one time | `price_1UVBxORrwe7mDXayCE8FqiTY` |
| Payment Link, lifetime | `plink_1UVBxURrwe7mDXay8xCJYKbF` https://buy.stripe.com/6oUbJ39fX2yh27E1ih4ow02 (payment mode, always creates a customer, metadata `atl_plan=lifetime`) |
| Customer portal | `bpc_1UVBaZRrwe7mDXayI6jlgr4Y` https://billing.stripe.com/p/login/3cI5kFdwdb4N3bIe534ow00 |
| Webhook destination | `we_1UVBeJRrwe7mDXayJStpNnCu` to `https://bwcqeyttbqkivrozbqxm.supabase.co/functions/v1/stripe-webhook`, events `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |
| Restricted key | `atl-supabase`, read access to Checkout Sessions, Subscriptions, Customers and Prices |

1. All three Payment Links redirect to `https://amongtheletters.com/account/?welcome=1`. The site adds `client_reference_id` and the locked email itself.
2. The portal allows cancelling at the end of the billing period, updating the card, viewing invoices and switching between monthly and yearly.
3. **[secret]** The webhook signing secret goes in Supabase as `STRIPE_WEBHOOK_SECRET`, the `atl-supabase` key as `STRIPE_SECRET_KEY`. Neither is ever written to the repo.
4. Lifetime. The webhook treats a paid `payment` mode checkout from the lifetime link (or `atl_plan=lifetime`) with a real account's user ID as lifetime. The member row gets plan `lifetime`, no subscription and no end date, and a forever Substack comp is queued. If the buyer still had a monthly or yearly subscription, it is **not** cancelled automatically. A "Cancel old plan" item appears in the admin to-do list, so a person cancels that subscription in Stripe. Subscription events never downgrade a lifetime member. Refunds of a lifetime payment are handled by hand (set the member row to `expired` and queue a Substack removal).
5. **Done** Founding member library. Lifetime buyers are called founding members and download every guide free from their account page. The private bucket `founding-downloads` (migration `20261027000200_founding_downloads.sql`, no public access and no storage policies) holds the final Payhip files from `atl-project/guidebooks/payhip/`, saved as `opportunity-map.pdf`, `submission-desk.pdf`, `submission-tracker.xlsx` and `submission-tracker.csv`. The `founding-downloads` Edge Function (JWT verified) checks for an active lifetime membership and returns signed links that expire after ten minutes. To add or replace a file, upload it with
   ```bash
   npx supabase storage cp --experimental --project-ref bwcqeyttbqkivrozbqxm --content-type application/pdf new-guide.pdf ss:///founding-downloads/new-guide.pdf
   ```
   then add it to `FILES` in `supabase/functions/founding-downloads/index.ts` and to `FOUNDING_LIBRARY` in `src/lib/shop-content.ts`, and redeploy the function.
6. Tax note. Registering for GST/HST is required only above CA$30,000 a year in sales. Stripe Tax stays off.

## D. Browser push, optional (5 minutes)
1. **[box] [secret]** `npx web-push generate-vapid-keys`. Public key to the repo Variable `VAPID_PUBLIC_KEY` and the function secret of the same name, private key to the function secret `VAPID_PRIVATE_KEY`.
2. Without these, the browser notification switch is hidden and the bell still works. On iPhone, push works only after "Add to Home Screen".

## E. GitHub repository Variables (5 minutes)
**[browser]** github.com/AmongTheLetters/AmongTheLetters.github.io, Settings, Secrets and variables, Actions, **Variables** tab (not Secrets, these are all public)

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | anon key |
| `STRIPE_LINK_MONTHLY` | monthly Payment Link |
| `STRIPE_LINK_ANNUAL` | yearly Payment Link |
| `STRIPE_LINK_LIFETIME` | lifetime Payment Link (the build reads it as `VITE_STRIPE_LINK_LIFETIME`) |
| `STRIPE_PORTAL` | customer portal login link |
| `GOOGLE_SIGNIN` | leave unset (off) |
| `VAPID_PUBLIC_KEY` | optional |

The Pages workflow passes these into the build. The keepalive workflow (`supabase-keepalive.yml`) starts pinging the project twice a week once `SUPABASE_URL` is set, so the free project does not pause.

## F. Substack allowlist (10 minutes, then monthly)
1. **[browser] [Chris]** Substack dashboard, Subscribers, Export. Save the CSV to the box, outside the repo.
2. **[box] [secret]**
   ```bash
   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-substack-allowlist.mjs /path/to/export.csv
   rm /path/to/export.csv
   ```
   Paid, founding and gift subscribers are added, comps skipped, lapsed ones switched off.
3. Repeat monthly, ideally as a routine on the first Monday.

## G. Test before merging (30 minutes)
Run a local live build against the real project with `.env.local` (public values only, gitignored), `npm run dev`.
1. Create an account with a test address, confirm it through the Brevo email, sign out, sign in again, use the sign-in link, reset the password.
2. Stripe test mode first if wanted (test Payment Links and a test webhook destination with its own secret), then live with a real CA$7 charge refunded afterwards.
3. After paying, the account page shows Member (or Lifetime member with no renewal date for the CA$299 link), the database opens, and the Substack to-do card plus the 9 a.m. email list the comp.
4. Save a search, follow a listing closing within a week, wait for the hourly run (or call the function with the cron secret), and check the bell, the deep link highlight, and email when switched on.
5. Cancel in the portal, check "Ends on ..." shows, and that `customer.subscription.deleted` queues the removal at the end.
6. Sign up with an allowlisted Substack email and check it opens without payment.

## H. Launch
1. **[Chris]** Approve the merge of `opportunities-db` into `main` and the push. The Pages workflow builds with the Variables and the site goes live with accounts.
2. Do the first Substack comps from the to-do list.
3. Optional announcement in the Monday email.

Rolling back is one step. Delete the `SUPABASE_URL` Variable and re-run the Pages workflow, and the site returns to the free list with "Memberships open soon".
