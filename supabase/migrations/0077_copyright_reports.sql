-- Copyright reports: photos and work people upload that aren't theirs.
--
-- Profile photos, portfolio photos/videos, request photos and chat images
-- are all user uploads. The Terms (docs/legal/terms-of-service.md §11) now
-- promise a way to report content that infringes someone's copyright and
-- that we take it down; this adds that reason to the existing report flow
-- (src/components/ReportSheet.tsx), reviewed on the admin Reports page.

alter table public.user_reports drop constraint if exists user_reports_reason_check;
alter table public.user_reports add constraint user_reports_reason_check
  check (reason in ('harassment', 'scam_or_fraud', 'inappropriate_content', 'unsafe_behavior', 'fake_profile', 'other', 'contact_sharing', 'copyright'));
