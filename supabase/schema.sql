-- Among The Letters membership schema (Supabase Postgres). NOT DEPLOYED. Draft for review.
-- Members-only listings are protected by row-level security, so the public anon key cannot read them.

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

create table public.opportunities (
  id text primary key,
  title text not null, org text not null, type text not null,
  genres text[] not null default '{}', region text not null, location text, eligibility text,
  opens date, deadline date, deadline_note text,
  fee text check (fee in ('Free','Fee','Check')), award text, summary text,
  url text not null, verified date not null, added date not null default current_date,
  tier text not null default 'members' check (tier in ('free','members'))
);

-- Work queue for the Substack step. Substack has no public API for comps, so a person or the
-- weekly routine works through this list in the Substack dashboard and marks each row done.
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

create table public.alert_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  weekly boolean default true, closing_soon boolean default true,
  saved_searches boolean default false, calendar_feed boolean default false,
  calendar_token text unique default encode(gen_random_bytes(18), 'hex'),
  saved_search jsonb
);

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.user_id = auth.uid()
    and m.status in ('active','past_due','canceling') and m.current_period_end > now());
$$;

alter table public.members enable row level security;
alter table public.opportunities enable row level security;
alter table public.substack_queue enable row level security;
alter table public.alert_prefs enable row level security;

-- Free listings for everyone, members-only listings only for active members.
create policy "free listings are public" on public.opportunities for select using (tier = 'free');
create policy "members see everything" on public.opportunities for select to authenticated using (public.is_active_member());

-- A member can read their own membership row. Only the webhook (service role) writes it.
create policy "read own membership" on public.members for select to authenticated using (user_id = auth.uid());

create policy "own alert prefs" on public.alert_prefs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
-- substack_queue has no policies on purpose: only the service role (webhook, admin tools) can touch it.

-- Locked teaser cards for visitors (type, region, genres and deadline month only).
create or replace view public.opportunity_stubs with (security_invoker = false) as
  select id, type, region, genres, fee, to_char(deadline, 'YYYY-MM') as deadline_month, added
  from public.opportunities where tier = 'members' and (deadline is null or deadline >= current_date);
grant select on public.opportunity_stubs to anon, authenticated;
