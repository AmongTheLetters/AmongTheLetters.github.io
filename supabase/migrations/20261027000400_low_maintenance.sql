-- Low-maintenance listings. Annual listings roll forward to an expected month, one-time listings hide after
-- their deadline, rolling listings never expire, and a monthly link check hides listings that stay dead.
alter table public.opportunities
  add column recurrence text not null default 'one-time' check (recurrence in ('annual','rolling','one-time')),
  add column typical_open_month smallint check (typical_open_month between 1 and 12),
  add column typical_close_month smallint check (typical_close_month between 1 and 12),
  add column pays_writer boolean not null default false,
  add column pay_rate text,
  add column fee_amount numeric(10,2),
  add column fee_currency text check (fee_currency in ('CAD','USD','GBP','EUR','AUD')),
  add column source text,
  add column last_checked date,
  -- managed by the link-check function, never by the sync script
  add column link_status text not null default 'unknown' check (link_status in ('ok','dead','unknown')),
  add column link_fail_count smallint not null default 0,
  add column link_checked_at timestamptz;

alter table public.opportunities add constraint opportunities_type_check
  check (type in ('Contest','Prize','Call for submissions','Grant','Residency','Fellowship','Mentorship','Paid market','Reading program'));

-- A listing is shown while its link is alive (or failed only once) and it is not a finished one-time listing.
create or replace function public.opportunity_visible(o public.opportunities) returns boolean language sql stable as $$
  select o.link_fail_count < 2 and (o.recurrence <> 'one-time' or o.deadline is null or o.deadline >= current_date)
$$;

drop policy "free listings are public" on public.opportunities;
drop policy "members see every listing" on public.opportunities;
create policy "free listings are public" on public.opportunities for select to anon, authenticated
  using (tier = 'free' and link_fail_count < 2);
create policy "members see every listing" on public.opportunities for select to authenticated
  using (public.is_active_member() and link_fail_count < 2);

drop view if exists public.opportunity_stubs;
create view public.opportunity_stubs with (security_invoker = false) as
  select id, type, region, genres, fee, to_char(deadline, 'YYYY-MM') as deadline_month, added,
         recurrence, typical_close_month, pays_writer
  from public.opportunities o where tier = 'members' and public.opportunity_visible(o);
revoke all on public.opportunity_stubs from public;
grant select on public.opportunity_stubs to anon, authenticated;

-- Monthly link check, 06:23 UTC on the 3rd. Uses the same Vault secrets as the hourly alerts run.
select cron.schedule('atl-link-check-monthly', '23 6 3 * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/link-check',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 120000)
$$);
