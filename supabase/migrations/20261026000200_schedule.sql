-- Hourly alerts run. Needs two Vault secrets created first (see LAUNCH_CHECKLIST.md, step S7):
--   project_url   https://<project-ref>.supabase.co
--   cron_secret   a long random string, the same value as the CRON_SECRET function secret
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('atl-alerts-hourly', '7 * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/alerts',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb)
$$);

-- The pause timer on free projects counts outside requests, so the keepalive lives in
-- .github/workflows/supabase-keepalive.yml rather than here. The hourly call above also helps.
