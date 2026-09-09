-- Let customer and provider screens watching the same request/quote/
-- opportunity/job get live updates via Supabase Realtime - the same
-- mechanism chat already uses for chat_messages - instead of only
-- refreshing on a manual pull-to-refresh or a same-device query
-- invalidation (which never reaches the other person's device at all).

do $$
begin
  begin
    alter publication supabase_realtime add table public.service_requests;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.quotes;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.request_opportunities;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.jobs;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end $$;
