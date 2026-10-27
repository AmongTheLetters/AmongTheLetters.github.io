-- Complimentary founding (lifetime) memberships, granted by email.
-- Run grants with:  select public.grant_founding('reader@example.com', 'why');   (service role / SQL only)
-- A grant applies at once if a confirmed account has that email, otherwise when the account is created
-- and its email confirmed. Unconfirmed accounts never receive a grant, so nobody can claim one by signing
-- up with someone else's address. Safe to run more than once. Contains no secrets.

alter table public.members add column if not exists comped boolean not null default false;

create table if not exists public.founding_grants (
  email text primary key check (email = lower(email)),
  note text,
  granted_at timestamptz not null default now(),
  applied_at timestamptz,
  user_id uuid references auth.users(id) on delete set null
);
alter table public.founding_grants enable row level security;   -- no policies, service role only

-- Turns a waiting grant into a founding membership for one user. Returns what happened.
create or replace function public.apply_founding_grant(p_user uuid) returns text
language plpgsql security definer set search_path = public, auth as $$
declare
  u record; g record; m public.members; had_sub boolean := false; allow boolean; now_ts timestamptz := now();
begin
  select id, lower(email) as email, email_confirmed_at into u from auth.users where id = p_user;
  if u.id is null then return 'no such user'; end if;
  select * into g from founding_grants where email = u.email and applied_at is null;
  if g.email is null then return 'no grant'; end if;
  if u.email_confirmed_at is null then return 'waiting for email confirmation'; end if;

  select * into m from members where user_id = p_user;
  if m.user_id is not null and m.plan = 'lifetime' and m.status = 'active' then
    update founding_grants set applied_at = now_ts, user_id = p_user where email = g.email;
    return 'already a founding member';
  end if;
  had_sub := m.user_id is not null and m.stripe_subscription_id is not null and public.member_row_active(m);

  insert into members (user_id, email, status, plan, comped, stripe_subscription_id, current_period_end, started_at, updated_at)
  values (p_user, u.email, 'active', 'lifetime', true, null, null, now_ts, now_ts)
  on conflict (user_id) do update set status = 'active', plan = 'lifetime', comped = true, stripe_subscription_id = null,
    current_period_end = null, started_at = case when had_sub then members.started_at else now_ts end, updated_at = now_ts;

  allow := exists (select 1 from substack_allowlist a where a.email = u.email and a.active);
  if not allow then
    -- A monthly comp is already forever. A yearly comp is extended to forever. Everyone else gets a new forever comp.
    if not had_sub then insert into substack_queue (user_id, email, action, comp_until) values (p_user, u.email, 'comp', null);
    elsif m.plan = 'annual' then insert into substack_queue (user_id, email, action, comp_until) values (p_user, u.email, 'extend', null);
    end if;
  end if;
  -- Never cancel automatically here. A person cancels the paid subscription in Stripe.
  if had_sub then
    insert into substack_queue (user_id, email, action, note) values (p_user, u.email, 'cancel_subscription',
      format('Complimentary founding membership granted. Cancel the old %s subscription %s in Stripe so it stops billing.', m.plan, m.stripe_subscription_id));
  end if;
  update founding_grants set applied_at = now_ts, user_id = p_user where email = g.email;
  return 'applied';
end $$;

-- Record a grant and apply it if the account already exists. Service role only.
create or replace function public.grant_founding(p_email text, p_note text default null) returns text
language plpgsql security definer set search_path = public, auth as $$
declare e text := lower(trim(p_email)); uid uuid; res text;
begin
  if e is null or e !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'not an email address: %', p_email; end if;
  insert into founding_grants (email, note) values (e, p_note)
  on conflict (email) do update set note = coalesce(excluded.note, founding_grants.note);
  select id into uid from auth.users where lower(email) = e;
  if uid is null then return e || ': saved, applies when this email signs up and confirms'; end if;
  res := public.apply_founding_grant(uid);
  return e || ': ' || case res when 'no grant' then 'already applied earlier' when 'waiting for email confirmation' then 'saved, applies once the account confirms its email' else res end;
end $$;

revoke execute on function public.apply_founding_grant(uuid) from public, anon, authenticated;
revoke execute on function public.grant_founding(text, text) from public, anon, authenticated;

-- New accounts, confirmations and email changes pick up a waiting grant. A failure here never blocks sign-up.
create or replace function public.handle_founding_grant() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email_confirmed_at is not null and exists (select 1 from founding_grants where email = lower(new.email) and applied_at is null) then
    begin perform public.apply_founding_grant(new.id);
    exception when others then raise warning 'founding grant for % not applied: %', new.id, sqlerrm; end;
  end if;
  return new;
end $$;
revoke execute on function public.handle_founding_grant() from public, anon, authenticated;
drop trigger if exists on_auth_user_founding_grant on auth.users;
create trigger on_auth_user_founding_grant after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.handle_founding_grant();

-- The account page shows "complimentary" instead of a price for comped founding members.
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
    'comped', coalesce((select comped from m), false),
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
