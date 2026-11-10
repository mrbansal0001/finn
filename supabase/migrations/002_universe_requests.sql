-- NSE equity list for search/validation (public), written by the worker.
create table if not exists public.universe (
  symbol text primary key,
  name   text not null
);
alter table public.universe enable row level security;
create policy "public read" on public.universe for select to anon, authenticated using (true);

-- Coverage requests: only real NSE symbols, at most 5 per session (the worker validates again).
create policy "request coverage" on public.coverage_requests for insert to authenticated
  with check (
    status = 'queued' and detail is null
    and requested_by = (select auth.uid())
    and symbol ~ '^[A-Z0-9&-]{1,20}$'
    and exists (select 1 from public.universe u where u.symbol = coverage_requests.symbol)
    and (select count(*) from public.coverage_requests c where c.requested_by = (select auth.uid())) < 5
  );
