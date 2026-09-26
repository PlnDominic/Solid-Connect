-- Payments were simulated with permissive RLS: anyone signed in could read
-- every payment, and a job's customer could update its own payment row
-- directly (e.g. set status = 'released' or edit the amount) without going
-- through confirm_job_completion. Money state now changes only through
-- SECURITY DEFINER RPCs (confirm_job_completion) or the admin service role.

drop policy if exists "payments are publicly readable" on public.payments;
drop policy if exists "the job's customer manages its payment" on public.payments;
drop policy if exists "the job's customer updates its payment" on public.payments;

-- Only the two parties to the job (and admins) can see a payment.
create policy "job parties and admins read payments" on public.payments
  for select using (
    public.is_admin()
    or exists (
      select 1 from public.jobs j
      where j.id = payments.job_id
        and (j.customer_id = auth.uid() or j.provider_id = auth.uid())
    )
  );

-- The accept-quote flow still creates the escrow row client-side, but it
-- can only ever start as an untouched pending payment.
create policy "job customer opens a pending payment" on public.payments
  for insert with check (
    status = 'pending'
    and released_at is null
    and exists (
      select 1 from public.jobs j
      where j.id = job_id and j.customer_id = auth.uid()
    )
  );

-- Deliberately no update/delete policy for authenticated users.
