-- Referral program: real invite codes, attribution at signup, and a
-- reward ledger earned on the referred user's first completed job.
--
-- Replaces the ReferralScreen's fake client-side code (initials + profile
-- id slice) with a server-generated unique code, and the "Rewards ... not
-- live yet" note with a real ledger. Money still isn't real (payments are
-- simulated until a MoMo/card gateway lands - see README "Explicitly still
-- simulated"), so a reward is recorded as credit in `referrals` and paid
-- out as part of Phase G (real provider payouts), not moved by this
-- migration.
--
-- Flow: referrer generates a code (my_referral_code, called by the
-- ReferralScreen) → invitee enters/taps the code → claim_referral() runs
-- after signup (30-day window, one referral per account, no self- or
-- loop-referrals) → the invitee's first confirmed-completed job flips the
-- ledger row pending → earned (maybe_earn_referral_reward trigger) and
-- notifies the referrer.

-- ── referral_codes ─────────────────────────────────────────────────────
-- One code per user. Codes are shared publicly (in chat threads, on
-- flyers), so reads are open to any signed-in user; writes happen only
-- through the SECURITY DEFINER generator below so a user can never grab
-- or overwrite someone else's code.
create table public.referral_codes (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create index referral_codes_user_idx on public.referral_codes(user_id);

alter table public.referral_codes enable row level security;

create policy "authenticated can look up referral codes"
  on public.referral_codes for select
  to authenticated
  using (true);

-- ── referrals ──────────────────────────────────────────────────────────
-- The ledger. referred_id is unique: an account can be referred at most
-- once, ever. reward_amount is stamped when the reward is earned so a
-- later change to the program's rate can't rewrite history.
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null unique references public.profiles(id) on delete cascade,
  code_used text not null,
  status text not null default 'pending' check (status in ('pending', 'earned', 'paid')),
  reward_amount integer,
  job_id uuid references public.jobs(id),
  earned_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index referrals_referrer_idx on public.referrals(referrer_id);
create index referrals_referred_idx on public.referrals(referred_id);

alter table public.referrals enable row level security;

create policy "parties can read their own referrals"
  on public.referrals for select
  to authenticated
  using (referrer_id = auth.uid() or referred_id = auth.uid());

-- Status transitions (pending → earned by the trigger below, earned → paid
-- by the eventual payout run) happen server-side only: no insert/update
-- policy is granted, so a client can neither self-award a reward nor
-- rewrite the ledger.

-- ── code generation ────────────────────────────────────────────────────
-- Idempotent: returns the caller's existing code or mints one. Format is
-- up to 4 letters from the profile's name (padded with X for very short
-- names) + 4 unambiguous base32 characters, e.g. KWA-M3P7 without the
-- dash (KWM3P7-style, 8 chars). Collision retries with a fresh suffix.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_name text;
  v_prefix text;
  v_suffix text;
  v_attempt integer := 0;
begin
  if auth.uid() is null then
    return null;
  end if;

  select code into v_code from public.referral_codes where user_id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;

  select coalesce(full_name, '') into v_name from public.profiles where id = auth.uid();
  v_prefix := upper(regexp_replace(coalesce(v_name, ''), '[^A-Za-z]', '', 'g'));
  v_prefix := substr(v_prefix, 1, 4);
  if char_length(v_prefix) < 2 then
    v_prefix := 'SC';
  end if;

  loop
    v_suffix := '';
    for i in 1 .. 4 loop
      v_suffix := v_suffix || substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1);
    end loop;
    v_code := rpad(v_prefix, 4, 'X') || v_suffix;
    begin
      insert into public.referral_codes (user_id, code)
      values (auth.uid(), v_code);
      return v_code;
    exception when unique_violation then
      v_attempt := v_attempt + 1;
      if v_attempt >= 8 then
        raise exception 'REFERRAL_CODE_GENERATION_FAILED';
      end if;
    end;
  end loop;
end;
$$;

-- Pre-claim validation for the sign-up/sign-in UI: resolves a code to the
-- referrer's first name (null when unknown) so the UI can show "Kwame
-- invited you" before the account exists. SECURITY DEFINER so it reads
-- referral_codes without exposing the code → user_id mapping to direct
-- table scans by anonymous users.
create or replace function public.lookup_referral(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select split_part(p.full_name, ' ', 1)
  from public.referral_codes rc
  join public.profiles p on p.id = rc.user_id
  where rc.code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
  limit 1;
$$;

-- ── claiming ───────────────────────────────────────────────────────────
-- Runs as the invitee, right after signup (or a first sign-in inside the
-- window). Guardrails, in order: sane code format; profile exists; within
-- 30 days of account creation; code resolves; not self-referral; no
-- direct loop (A can't be referred by B if B was just referred by A -
-- longer chains are fine); not already referred (belt) with the unique
-- constraint on referred_id as braces (suspenders).
create or replace function public.claim_referral(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_referrer uuid;
  v_profile public.profiles%rowtype;
begin
  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  if char_length(v_code) < 6 then
    raise exception 'INVALID_REFERRAL_CODE';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.id is null then
    raise exception 'PROFILE_NOT_FOUND';
  end if;
  if v_profile.created_at < now() - interval '30 days' then
    raise exception 'REFERRAL_WINDOW_CLOSED';
  end if;
  if exists (select 1 from public.referrals where referred_id = auth.uid()) then
    raise exception 'ALREADY_REFERRED';
  end if;

  select user_id into v_referrer from public.referral_codes where code = v_code;
  if v_referrer is null then
    raise exception 'REFERRAL_CODE_NOT_FOUND';
  end if;
  if v_referrer = auth.uid() then
    raise exception 'CANNOT_REFER_YOURSELF';
  end if;
  if exists (
    select 1 from public.referrals
    where referrer_id = auth.uid() and referred_id = v_referrer
  ) then
    raise exception 'REFERRAL_LOOP';
  end if;

  begin
    insert into public.referrals (referrer_id, referred_id, code_used)
    values (v_referrer, auth.uid(), v_code);
  exception when unique_violation then
    raise exception 'ALREADY_REFERRED';
  end;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_referrer,
    'REFERRAL_JOINED',
    'Referral joined',
    v_profile.full_name || ' joined with your code. Your reward is earned when they complete their first job.',
    jsonb_build_object('referredId', auth.uid())
  );

  return true;
end;
$$;

-- ── reward earning ─────────────────────────────────────────────────────
-- A referral is earned when the referred customer's first job completes
-- with customer confirmation - the same moment the (simulated) payment
-- releases in confirm_job_completion. AFTER UPDATE on jobs is the single
-- hook: every completion path (RPC, Nest API) funnels through that update.
create or replace function public.maybe_earn_referral_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referral public.referrals%rowtype;
begin
  if new.status <> 'completed' or new.customer_confirmed_at is null then
    return new;
  end if;
  if old.status = 'completed' and old.customer_confirmed_at is not null then
    return new; -- already processed; confirm_job_completion is idempotent
  end if;

  select * into v_referral
  from public.referrals
  where referred_id = new.customer_id and status = 'pending'
  limit 1;
  if v_referral.id is null then
    return new;
  end if;

  update public.referrals
  set status = 'earned', job_id = new.id, reward_amount = 10, earned_at = now()
  where id = v_referral.id
  returning * into v_referral;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    v_referral.referrer_id,
    'REFERRAL_REWARD_EARNED',
    'Referral reward earned',
    'Your friend completed their first job. GHS 10 referral credit is yours - it lands with your next payout.',
    jsonb_build_object('jobId', new.id, 'referralId', v_referral.id, 'amount', v_referral.reward_amount)
  );

  return new;
end;
$$;

drop trigger if exists referrals_earn_on_completion on public.jobs;
create trigger referrals_earn_on_completion
  after update of status, customer_confirmed_at on public.jobs
  for each row execute function public.maybe_earn_referral_reward();

grant execute on function public.my_referral_code to authenticated;
grant execute on function public.lookup_referral to anon, authenticated;
grant execute on function public.claim_referral to authenticated;
