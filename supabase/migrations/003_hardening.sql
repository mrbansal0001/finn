-- 003: hardening after the 12 Nov review (docs/REVIEW-2026-11-12.md, Tier 2)
-- Run once in the Supabase SQL editor. Idempotent where Postgres allows.

-- 1. Private tables: visitors may READ their own rows only. Nothing in the app writes them; the seeding
--    trigger (security definer) and the worker (service role) bypass RLS. Before this, "for all" let any
--    anonymous session insert unlimited rows of any size into its own tables.
do $$
declare t text;
begin
  foreach t in array array['contacts', 'contact_edges', 'network_lines', 'portfolios', 'prefs'] loop
    execute format('drop policy if exists "owner only" on public.%I', t);
    execute format('drop policy if exists "owner reads" on public.%I', t);
    execute format($p$create policy "owner reads" on public.%I for select to authenticated
                     using ((select auth.uid()) = owner_id)$p$, t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2. Coverage requests: anyone may see a ticker's status; nobody may see who asked.
create or replace function public.my_request_count() returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.coverage_requests where requested_by = (select auth.uid())
$$;
revoke execute on function public.my_request_count() from public, anon;
grant execute on function public.my_request_count() to authenticated;

create or replace function public.requests_today() returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.coverage_requests where requested_at > now() - interval '1 day'
$$;
revoke execute on function public.requests_today() from public, anon;
grant execute on function public.requests_today() to authenticated;

drop policy if exists "request coverage" on public.coverage_requests;
create policy "request coverage" on public.coverage_requests for insert to authenticated
  with check (
    status = 'queued' and detail is null
    and requested_by = (select auth.uid())
    and symbol ~ '^[A-Z0-9&-]{1,20}$'
    and exists (select 1 from public.universe u where u.symbol = coverage_requests.symbol)
    and public.my_request_count() < 5          -- per visitor session
    and public.requests_today() < 50           -- everyone together: sessions are free to mint
  );

revoke select on public.coverage_requests from anon, authenticated;
grant select (symbol, requested_at, status, detail) on public.coverage_requests to anon, authenticated;

-- 3. Retention: an anonymous demo visitor and their private copy of the network (cascade) are deleted
--    after 14 days. Real users would follow the written retention policy instead (docs/WRITEUP.md).
create extension if not exists pg_cron;
select cron.unschedule('finn-purge-anonymous') where exists (select 1 from cron.job where jobname = 'finn-purge-anonymous');
select cron.schedule('finn-purge-anonymous', '30 21 * * *',   -- 03:00 IST daily
  $$ delete from auth.users where is_anonymous and created_at < now() - interval '14 days' $$);
