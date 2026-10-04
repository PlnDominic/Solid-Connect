-- No phone numbers or bank / mobile-money account details in chat.
--
-- Keeps every booking and payment on Solid Connect. The app checks each
-- message before sending (src/lib/contactDetails.ts), refuses it and calls
-- flag_contact_details_attempt so admins see who tried. As a backstop for
-- older app versions and the Nest API, a trigger runs the same check on
-- every chat message, strips the details and files the same flag.
-- Flags are automatic user_reports (no human reporter, reason
-- 'contact_sharing'), reviewed on the admin Reports page.

-- ── user_reports: allow automatic flags ────────────────────────────────
alter table public.user_reports alter column reporter_id drop not null;

alter table public.user_reports drop constraint if exists user_reports_reason_check;
alter table public.user_reports add constraint user_reports_reason_check
  check (reason in ('harassment', 'scam_or_fraud', 'inappropriate_content', 'unsafe_behavior', 'fake_profile', 'other', 'contact_sharing'));

-- ── detection (keep in step with src/lib/contactDetails.ts) ────────────
-- A run of digits, with spaces, dashes, dots, brackets or a leading +
-- between them. Commas and slashes end a run (prices, dates pass).
create or replace function public.find_contact_details(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  run text;
  digits text;
  has_account_word boolean;
  longest int := 0;
begin
  if p_text is null or p_text = '' then
    return null;
  end if;
  has_account_word := p_text ~* '\y(account|acct|a/c|acc\s*no|momo|mobile\s*money|bank|iban|swift|sort\s*code)\y';
  for run in select (regexp_matches(p_text, '\+?\d[\d\s().-]*\d', 'g'))[1] loop
    digits := regexp_replace(run, '\D', '', 'g');
    if length(digits) >= 9 then
      if has_account_word
         or not ((length(digits) = 10 and left(digits, 1) = '0')
                 or (length(digits) = 12 and left(digits, 3) = '233')
                 or length(digits) = 9) then
        return 'account';
      end if;
      return 'phone';
    end if;
    longest := greatest(longest, length(digits));
  end loop;
  if has_account_word and longest >= 6 then
    return 'account';
  end if;
  return null;
end;
$$;

-- "024 123 4567" -> "024•••••67", so a flag never stores the full number.
create or replace function public.mask_contact_details(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  run text;
  digits text;
  result text := coalesce(p_text, '');
begin
  for run in select (regexp_matches(result, '\+?\d[\d\s().-]*\d', 'g'))[1] loop
    digits := regexp_replace(run, '\D', '', 'g');
    if length(digits) >= 6 then
      result := replace(result, run, left(digits, 3) || repeat('•', greatest(length(digits) - 5, 1)) || right(digits, 2));
    end if;
  end loop;
  return left(result, 900);
end;
$$;

-- One open flag per sender per chat every 10 minutes, so retries don't
-- bury the Reports page.
create or replace function public.file_contact_details_flag(p_thread_id uuid, p_sender_id uuid, p_kind text, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.user_reports
    where reason = 'contact_sharing'
      and reported_id = p_sender_id
      and thread_id = p_thread_id
      and status = 'open'
      and created_at > now() - interval '10 minutes'
  ) then
    return;
  end if;
  insert into public.user_reports (reporter_id, reported_id, context, thread_id, reason, details)
  values (
    null,
    p_sender_id,
    'chat',
    p_thread_id,
    'contact_sharing',
    'Tried to share ' || case when p_kind = 'phone' then 'a phone number' else 'account details' end
      || ' in chat: "' || public.mask_contact_details(p_text) || '"'
  );
end;
$$;

revoke all on function public.file_contact_details_flag(uuid, uuid, text, text) from public, anon, authenticated;

-- ── the app reports a message it refused to send ───────────────────────
create or replace function public.flag_contact_details_attempt(p_thread_id uuid, p_text text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.find_contact_details(p_text);
begin
  if auth.uid() is null or kind is null then
    return;
  end if;
  if not exists (
    select 1 from public.chat_threads t
    where t.id = p_thread_id and (t.customer_id = auth.uid() or t.provider_id = auth.uid())
  ) then
    return;
  end if;
  perform public.file_contact_details_flag(p_thread_id, auth.uid(), kind, p_text);
end;
$$;

revoke all on function public.flag_contact_details_attempt(uuid, text) from public, anon;
grant execute on function public.flag_contact_details_attempt(uuid, text) to authenticated;

-- ── backstop: strip anything that reaches the table ───────────────────
create or replace function public.strip_contact_details_from_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  kind text := public.find_contact_details(new.text);
begin
  if kind is not null then
    perform public.file_contact_details_flag(new.thread_id, new.sender_id, kind, new.text);
    new.text := case when kind = 'phone'
      then '[Phone number removed - phone numbers can''t be shared in chat]'
      else '[Account details removed - all payments go through Solid Connect]'
    end;
  end if;
  return new;
end;
$$;

drop trigger if exists chat_messages_strip_contact_details on public.chat_messages;
create trigger chat_messages_strip_contact_details
  before insert or update of text on public.chat_messages
  for each row execute function public.strip_contact_details_from_message();
