-- Among The Letters, the one-time CA$299 lifetime membership.
-- Lifetime members have plan 'lifetime', status 'active', no subscription and no current_period_end.
-- Every place that decides access goes through public.member_row_active(), so a lifetime row counts everywhere.
-- Safe to run more than once. Contains no secrets.

alter table public.members drop constraint if exists members_plan_check;
alter table public.members add constraint members_plan_check check (plan in ('monthly','annual','lifetime'));
-- A lifetime row never carries a subscription or a period end.
alter table public.members drop constraint if exists members_lifetime_shape;
alter table public.members add constraint members_lifetime_shape
  check (plan is distinct from 'lifetime' or (stripe_subscription_id is null and current_period_end is null));

-- The Substack to-do list doubles as the admin to-do list. 'cancel_subscription' asks a person to cancel an
-- old monthly or yearly Stripe subscription after someone buys lifetime (never cancelled automatically).
alter table public.substack_queue drop constraint if exists substack_queue_action_check;
alter table public.substack_queue add constraint substack_queue_action_check check (action in ('comp','extend','remove','cancel_subscription'));
alter table public.substack_queue add column if not exists note text;

-- One rule for "this membership row grants access".
create or replace function public.member_row_active(m public.members) returns boolean
language sql stable as $$
  select coalesce((m.plan = 'lifetime' and m.status = 'active')
      or (m.status in ('active','past_due','canceling') and m.current_period_end > now()), false);
$$;

create or replace function public.is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from members m where m.user_id = auth.uid() and public.member_row_active(m))
      or exists (select 1 from substack_allowlist a where a.email = public.jwt_email() and a.active);
$$;

create or replace function public.my_membership() returns jsonb
language sql stable security definer set search_path = public as $$
  with m as (select * from members where user_id = auth.uid()),
       a as (select * from substack_allowlist where email = public.jwt_email() and active),
       q as (select * from substack_queue where user_id = auth.uid() and action in ('comp','extend','remove') order by created_at desc limit 1)
  select jsonb_build_object(
    'status', case when exists (select 1 from m where public.member_row_active(m)) then (select status from m)
                   when exists (select 1 from a) then 'active'
                   when exists (select 1 from m) then (select case when status = 'none' then 'none' else 'expired' end from m)
                   else 'none' end,
    'plan', (select plan from m),
    'periodEnd', (select current_period_end::date from m),
    'startedAt', (select started_at::date from m),
    'source', case when exists (select 1 from m where public.member_row_active(m)) then 'stripe'
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

-- Used by the alerts function and the calendar feed (service role only).
create or replace function public.alert_recipients() returns table (user_id uuid, email text)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email from auth.users u
  where exists (select 1 from members m where m.user_id = u.id and public.member_row_active(m))
     or exists (select 1 from substack_allowlist a where a.email = lower(u.email) and a.active and u.email_confirmed_at is not null);
$$;
revoke execute on function public.alert_recipients() from public, anon, authenticated;
