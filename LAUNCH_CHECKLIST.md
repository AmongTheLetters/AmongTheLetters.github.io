# Launch checklist, opportunities database and memberships

Everything in the repo is built. This list is the outside setup, in order. Nothing here has been done yet.

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
| Stripe Payment Link URLs, monthly and yearly | Public | Repo Variables `STRIPE_LINK_MONTHLY`, `STRIPE_LINK_ANNUAL` |
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
12. **[box] [secret]** Deploy the three functions. Create an access token at supabase.com, Account, Access Tokens, then from the repo
    ```bash
    export SUPABASE_ACCESS_TOKEN=...   # in the shell only
    npx supabase functions deploy stripe-webhook alerts calendar-feed --project-ref <ref>
    unset SUPABASE_ACCESS_TOKEN
    ```
    `supabase/config.toml` turns off the Supabase token check for these three, because each checks its own secret. Revoke the access token afterwards if you like.
13. **[box] [secret]** Load the listings
    ```bash
    SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... node scripts/sync-opportunities.mjs
    ```
    It should report 25 listings, 12 free (or the current numbers).

## C. Stripe on the Minocy account (about 20 minutes)
1. **[Chris]** Decide what buyers see. Checkout, receipts and card statements show the Stripe account's public business name and statement descriptor, which today say Minocy. Options are to keep Minocy, change the public details on that account (Stripe may re-check them), or add a second account under the same login for *Among The Letters* (free, but it asks for business details and possibly ID). Steps below assume the Minocy account.
2. **[browser]** Product catalogue, Add product. Name `Among The Letters membership`, description "The full opportunities database, notifications and a paid Substack subscription." Two recurring prices in **CAD**, CA$7.00 monthly and CA$70.00 yearly. No trial.
3. **[browser]** Payment Links, New, for the monthly price.
   - Do not allow quantity changes. Collect name off, address off unless tax is needed.
   - After payment, "Don't show confirmation page", redirect to `https://amongtheletters.com/account/?welcome=1`.
   - Save and copy the link (`https://buy.stripe.com/...`).
   Repeat for the yearly price. The site adds `client_reference_id` and the locked email itself, nothing to set for that.
4. **[browser]** Settings, Billing, Customer portal. Activate the login link and copy it. Allow cancel subscriptions (at end of billing period), update payment methods and view invoices. Allow switching between the two prices if you like.
5. **[browser] [secret]** Developers (Workbench), Webhooks, Add destination. Endpoint URL `https://<ref>.supabase.co/functions/v1/stripe-webhook`. Events
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   Save, reveal the signing secret `whsec_...` and put it in Supabase as `STRIPE_WEBHOOK_SECRET`.
6. **[browser] [secret]** Developers, API keys, Create restricted key `atl-supabase` with read access to Checkout Sessions, Subscriptions, Customers and Prices (everything else none). Put it in Supabase as `STRIPE_SECRET_KEY`.
7. Tax note. Registering for GST/HST is required only above CA$30,000 a year in sales. Stripe Tax stays off.

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
3. After paying, the account page shows Member, the database opens, and the Substack to-do card plus the 9 a.m. email list the comp.
4. Save a search, follow a listing closing within a week, wait for the hourly run (or call the function with the cron secret), and check the bell, the deep link highlight, and email when switched on.
5. Cancel in the portal, check "Ends on ..." shows, and that `customer.subscription.deleted` queues the removal at the end.
6. Sign up with an allowlisted Substack email and check it opens without payment.

## H. Launch
1. **[Chris]** Approve the merge of `opportunities-db` into `main` and the push. The Pages workflow builds with the Variables and the site goes live with accounts.
2. Do the first Substack comps from the to-do list.
3. Optional announcement in the Monday email.

Rolling back is one step. Delete the `SUPABASE_URL` Variable and re-run the Pages workflow, and the site returns to the free list with "Memberships open soon".
