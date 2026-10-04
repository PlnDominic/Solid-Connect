-- Catch phone / account numbers typed as one joined word or mixed with
-- digits: "Zerotwofourtwosixtwosixtwoeightseven",
-- "Zerotwofourtwosixtwosixtwoeight7", "zero2four2six...". Keep in step with
-- src/lib/contactDetails.ts. Requires 0071 and 0072; replaces their
-- detection and masking functions in place.
--
-- The joined-up pass only runs when the strict (whole-word) pass finds no
-- number, and only a 9+ digit run counts, so ordinary words that contain a
-- number word ("someone", "phone", "money") never block a message alone.

create or replace function public.joined_number_words_to_digits(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  r text := coalesce(p_text, '');
begin
  -- No word boundaries here; "oh" is left out (noise inside "john", "though").
  r := regexp_replace(r, 'zero', ' 0 ', 'gi');
  r := regexp_replace(r, 'one', ' 1 ', 'gi');
  r := regexp_replace(r, 'two', ' 2 ', 'gi');
  r := regexp_replace(r, 'three', ' 3 ', 'gi');
  r := regexp_replace(r, 'four', ' 4 ', 'gi');
  r := regexp_replace(r, 'five', ' 5 ', 'gi');
  r := regexp_replace(r, 'six', ' 6 ', 'gi');
  r := regexp_replace(r, 'seven', ' 7 ', 'gi');
  r := regexp_replace(r, 'eight', ' 8 ', 'gi');
  r := regexp_replace(r, 'nine', ' 9 ', 'gi');
  r := regexp_replace(r, 'double\s*(\d)', '\1 \1', 'gi');
  r := regexp_replace(r, 'triple\s*(\d)', '\1 \1 \1', 'gi');
  return r;
end;
$$;

-- 'phone' / 'account' for a number in already-normalized text, else null.
create or replace function public.find_contact_number(p_normalized text)
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
  if p_normalized is null or p_normalized = '' then
    return null;
  end if;
  has_account_word := p_normalized ~* '\y(account|acct|a/c|acc\s*no|momo|mobile\s*money|bank|iban|swift|sort\s*code)\y';
  for run in select (regexp_matches(p_normalized, '\+?\d[\d\s().-]*\d', 'g'))[1] loop
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

create or replace function public.find_contact_details(p_text text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  kind text;
begin
  if p_text is null or p_text = '' then
    return null;
  end if;

  kind := coalesce(
    public.find_contact_number(public.number_words_to_digits(p_text)),
    public.find_contact_number(public.joined_number_words_to_digits(p_text))
  );
  if kind is not null then
    return kind;
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
  -- The joined-up conversion only when that's what found the number, so
  -- ordinary words stay readable in the flag.
  if public.find_contact_number(result) is null
     and public.find_contact_number(public.joined_number_words_to_digits(p_text)) is not null then
    result := public.joined_number_words_to_digits(p_text);
  end if;
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
