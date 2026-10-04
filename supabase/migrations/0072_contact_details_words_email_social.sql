-- Widen the chat contact-details check (0071) - keep in step with
-- src/lib/contactDetails.ts:
--   * phone / account numbers written in words ("zero two four ...",
--     "double five") are turned into digits and caught;
--   * personal emails - plain, spelled out ("kofi at gmail dot com") or a
--     mail provider named;
--   * social media - @handles and messaging / social platforms named;
--   * links - any web address.
-- Requires 0071. Replaces its functions in place; the trigger and the
-- flag_contact_details_attempt RPC pick the new rules up automatically.

create or replace function public.number_words_to_digits(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  r text := coalesce(p_text, '');
begin
  r := regexp_replace(r, '\y(zero|oh)\y', '0', 'gi');
  r := regexp_replace(r, '\yone\y', '1', 'gi');
  r := regexp_replace(r, '\ytwo\y', '2', 'gi');
  r := regexp_replace(r, '\ythree\y', '3', 'gi');
  r := regexp_replace(r, '\yfour\y', '4', 'gi');
  r := regexp_replace(r, '\yfive\y', '5', 'gi');
  r := regexp_replace(r, '\ysix\y', '6', 'gi');
  r := regexp_replace(r, '\yseven\y', '7', 'gi');
  r := regexp_replace(r, '\yeight\y', '8', 'gi');
  r := regexp_replace(r, '\ynine\y', '9', 'gi');
  r := regexp_replace(r, '\ydouble\s+(\d)', '\1 \1', 'gi');
  r := regexp_replace(r, '\ytriple\s+(\d)', '\1 \1 \1', 'gi');
  return r;
end;
$$;

create or replace function public.find_contact_details(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  normalized text;
  run text;
  digits text;
  has_account_word boolean;
  longest int := 0;
begin
  if p_text is null or p_text = '' then
    return null;
  end if;
  normalized := public.number_words_to_digits(p_text);
  has_account_word := normalized ~* '\y(account|acct|a/c|acc\s*no|momo|mobile\s*money|bank|iban|swift|sort\s*code)\y';

  for run in select (regexp_matches(normalized, '\+?\d[\d\s().-]*\d', 'g'))[1] loop
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

  if p_text ~* '[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}'
     or p_text ~* '[a-z0-9._-]+\s*(\(at\)|\[at\]|\{at\}|\yat\y)\s*[a-z0-9-]+\s*(\(dot\)|\[dot\]|\{dot\}|\ydot\y|\.)\s*(com|net|org|gh|co|edu|io|me)\y'
     or p_text ~* '\y(gmail|g-mail|yahoo|hotmail|outlook|icloud|protonmail|ymail|aol)\y' then
    return 'email';
  end if;

  if p_text ~* '(^|[\s(:])@[a-z0-9_.]{3,}'
     or p_text ~* '\y(whats\s?app|watsapp|wats\s?app|telegram|instagram|insta|ig|facebook|fb|messenger|tiktok|tik\s?tok|snapchat|twitter|linkedin|wechat|viber)\y' then
    return 'social';
  end if;

  if p_text ~* '\y(https?://|www\.)\S+'
     or p_text ~* '\y[a-z0-9-]+\.(com|net|org|gh|io|me|co|app|link|ly|biz|info)(/\S*)?\y'
     or p_text ~* '\y(wa\.me|x\.com|t\.me)\y' then
    return 'link';
  end if;

  return null;
end;
$$;

-- "024•••••67", "ko•••@gmail.com", "@ko•••" - a flag never stores the
-- full detail.
create or replace function public.mask_contact_details(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  run text;
  digits text;
  result text := public.number_words_to_digits(p_text);
begin
  for run in select (regexp_matches(result, '\+?\d[\d\s().-]*\d', 'g'))[1] loop
    digits := regexp_replace(run, '\D', '', 'g');
    if length(digits) >= 6 then
      result := replace(result, run, left(digits, 3) || repeat('•', greatest(length(digits) - 5, 1)) || right(digits, 2));
    end if;
  end loop;
  result := regexp_replace(result, '([a-z0-9._%+-]{1,2})[a-z0-9._%+-]*@', '\1•••@', 'gi');
  result := regexp_replace(result, '(^|[\s(:])@([a-z0-9_]{1,2})[a-z0-9_.]{2,}', '\1@\2•••', 'gi');
  return left(result, 900);
end;
$$;

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
    'Tried to share ' || case p_kind
        when 'phone' then 'a phone number'
        when 'account' then 'account details'
        when 'email' then 'an email address'
        when 'social' then 'social media details'
        else 'a link'
      end
      || ' in chat: "' || public.mask_contact_details(p_text) || '"'
  );
end;
$$;

revoke all on function public.file_contact_details_flag(uuid, uuid, text, text) from public, anon, authenticated;

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
    new.text := case kind
      when 'phone' then '[Phone number removed - phone numbers can''t be shared in chat]'
      when 'account' then '[Account details removed - all payments go through Solid Connect]'
      when 'email' then '[Email address removed - emails can''t be shared in chat]'
      when 'social' then '[Social media details removed - keep the conversation on Solid Connect]'
      else '[Link removed - links can''t be shared in chat]'
    end;
  end if;
  return new;
end;
$$;
