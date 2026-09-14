-- Schedules run_data_retention_cleanup() (0035) to actually run - daily
-- at 03:00 UTC, off-peak for a Ghana-timezone (GMT/UTC+0) user base.
-- Isolated in its own migration since pg_cron is new for this project;
-- if enabling it fails here, 0035's function/policy/table still stand.
create extension if not exists pg_cron;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'data-retention-cleanup') then
    perform cron.schedule(
      'data-retention-cleanup',
      '0 3 * * *',
      $sql$select public.run_data_retention_cleanup();$sql$
    );
  end if;
end
$$;
