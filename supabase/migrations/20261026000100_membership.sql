-- Among The Letters, accounts, membership, listings and alerts.
-- Run once in the Supabase SQL editor (or `supabase db push`). Contains no secrets.
-- Members-only listings and every personal row are protected by row-level security.

create extension if not exists pgcrypto;

-- ---------- tables ----------
create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status text not null default 'none' check (status in ('none','active','past_due','canceling','expired')),
  plan text check (plan in ('monthly','annual')),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  current_period_end timestamptz,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);

-- Paid Substack subscribers, imported from Substack's subscriber export (scripts/import-substack-allowlist.mjs).
-- Matched by email when someone signs in, so they get the database at no extra cost.
create table public.substack_allowlist (
  email text primary key check (email = lower(email)),
  subscription_type text,
  active boolean not null default true,
  first_seen date not null default current_date,
  last_seen date not null default current_date
);

create table public.admins (email text primary key check (email = lower(email)));

create table public.opportunities (
  id text primary key,
  title text not null, org text not null, type text not null,
  genres text[] not null default '{}', region text not null, location text, eligibility text,
  opens date, deadline date, deadline_note text,
  fee text check (fee in ('Free','Fee','Check')), award text, summary text,
  url text not null, verified date not null, added date not null default current_date,
  tier text not null default 'members' check (tier in ('free','members'))
);
create index on public.opportunities (deadline);
create index on public.opportunities (added);

-- Substack has no public API for comps, so this is a to-do list for a person.
create table public.substack_queue (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  action text not null check (action in ('comp','extend','remove')),
  comp_until date,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  done_by text
);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  filters jsonb not null,
  onsite boolean not null default true,
  email boolean not null default false,
  frequency text not null default 'instant' check (frequency in ('instant','daily','weekly')),
  created_at timestamptz not null default now(),
  last_checked_at timestamptz
);
create index on public.saved_searches (user_id);

create table public.follows (
  user_id uuid not null references auth.users(id) on delete cascade,
  opportunity_id text not null references public.opportunities(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);

create table public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('new_match','closing_soon','deadline_today','system')),
  title text not null,
  body text not null default '',
  link text not null default '/opportunities/',
  opportunity_id text references public.opportunities(id) on delete cascade,
  saved_search_id uuid references public.saved_searches(id) on delete cascade,
  onsite boolean not null default true,
  want_email boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  emailed_at timestamptz,
  pushed_at timestamptz,
  dedupe_key text generated always as (kind || ':' || coalesce(opportunity_id, '') || ':' || coalesce(saved_search_id::text, '')) stored,
  unique (user_id, dedupe_key)   -- the same alert is never created twice
);
create index on public.notifications (user_id, created_at desc);

create table public.notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email_enabled boolean not null default false,          -- email is opt-in
  closing_soon_days int not null default 7 check (closing_soon_days between 1 and 30),
  push_enabled boolean not null default false,
  calendar_token text unique not null default encode(gen_random_bytes(18), 'hex')
);

create table public.push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

-- ---------- helpers ----------
-- The signed-in person's email, only once they have confirmed it. Allowlist and admin checks use this,
-- so nobody can claim a paying subscriber's access by signing up with that address and never confirming.
create or replace function public.jwt_email() returns text
language sql stable security definer set search_path = auth as $$
  select coalesce((select lower(email) from auth.users where id = auth.uid() and email_confirmed_at is not null), '')
$$;

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.user_id = auth.uid()
           and m.status in ('active','past_due','canceling') and m.current_period_end > now())
      or exists (select 1 from substack_allowlist a where a.email = public.jwt_email() and a.active);
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select exists (select 1 from admins where email = public.jwt_email()) $$;

-- Everything the account page needs about the signed-in person, in one call.
create or replace function public.my_membership() returns jsonb
language sql stable security definer set search_path = public as $$
  with m as (select * from members where user_id = auth.uid()),
       a as (select * from substack_allowlist where email = public.jwt_email() and active),
       q as (select * from substack_queue where user_id = auth.uid() order by created_at desc limit 1)
  select jsonb_build_object(
    'status', case when exists (select 1 from m where status in ('active','past_due','canceling') and current_period_end > now()) then (select status from m)
                   when exists (select 1 from a) then 'active'
                   when exists (select 1 from m) then (select case when status = 'none' then 'none' else 'expired' end from m)
                   else 'none' end,
    'plan', (select plan from m),
    'periodEnd', (select current_period_end::date from m),
    'startedAt', (select started_at::date from m),
    'source', case when exists (select 1 from m where status in ('active','past_due','canceling') and current_period_end > now()) then 'stripe'
                   when exists (select 1 from a) then 'substack' else 'none' end,
    'substack', case when (select action from q) is null then 'not_started'
                     when (select action from q) in ('comp','extend') then case when (select done_at from q) is null then 'pending' else 'added' end
                     else case when (select done_at from q) is null then 'removal_pending' else 'removed' end end,
    'substackDate', (select done_at::date from q where action in ('comp','extend')),
    'isAdmin', public.is_admin());
$$;

create or replace function public.admin_substack_todo() returns setof public.substack_queue
language sql stable security definer set search_path = public as $$
  select * from substack_queue where done_at is null and public.is_admin() order by created_at;
$$;

create or replace function public.admin_mark_substack_done(item_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'not allowed'; end if;
  update substack_queue set done_at = now(), done_by = public.jwt_email() where id = item_id;
end $$;

-- For the alerts function only (service role). Every active member, from Stripe or the Substack allowlist.
create or replace function public.alert_recipients() returns table (user_id uuid, email text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email from auth.users u
  where exists (select 1 from members m where m.user_id = u.id and m.status in ('active','past_due','canceling') and m.current_period_end > now())
     or exists (select 1 from substack_allowlist a where a.email = lower(u.email) and a.active and u.email_confirmed_at is not null);
$$;
revoke execute on function public.alert_recipients() from public, anon, authenticated;

-- Every new account gets alert preferences with email off.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into notification_prefs (user_id) values (new.id) on conflict do nothing; return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- ---------- row-level security ----------
alter table public.members enable row level security;
alter table public.substack_allowlist enable row level security;
alter table public.admins enable row level security;
alter table public.opportunities enable row level security;
alter table public.substack_queue enable row level security;
alter table public.saved_searches enable row level security;
alter table public.follows enable row level security;
alter table public.notifications enable row level security;
alter table public.notification_prefs enable row level security;
alter table public.push_subscriptions enable row level security;
-- substack_allowlist, admins and substack_queue have no policies on purpose: only the service role and the
-- security definer functions above can reach them.

create policy "free listings are public" on public.opportunities for select to anon, authenticated using (tier = 'free');
create policy "members see every listing" on public.opportunities for select to authenticated using (public.is_active_member());

create policy "read own membership" on public.members for select to authenticated using (user_id = auth.uid());

create policy "own saved searches" on public.saved_searches for select to authenticated using (user_id = auth.uid());
create policy "members save searches" on public.saved_searches for insert to authenticated with check (user_id = auth.uid() and public.is_active_member());
create policy "edit own saved searches" on public.saved_searches for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "delete own saved searches" on public.saved_searches for delete to authenticated using (user_id = auth.uid());

create policy "own follows" on public.follows for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own on-site notifications" on public.notifications for select to authenticated using (user_id = auth.uid() and onsite);
create policy "mark own notifications read" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

create policy "own prefs" on public.notification_prefs for select to authenticated using (user_id = auth.uid());
create policy "edit own prefs" on public.notification_prefs for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notification_prefs from authenticated;
grant update (email_enabled, closing_soon_days, push_enabled) on public.notification_prefs to authenticated;

create policy "own push subscriptions" on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Locked teaser cards for non-members. Runs as the view owner, so it can read members-only rows,
-- but it only exposes type, region, genres, fee and the deadline month.
create or replace view public.opportunity_stubs with (security_invoker = false) as
  select id, type, region, genres, fee, to_char(deadline, 'YYYY-MM') as deadline_month, added
  from public.opportunities where tier = 'members' and (deadline is null or deadline >= current_date);
revoke all on public.opportunity_stubs from public;
grant select on public.opportunity_stubs to anon, authenticated;
