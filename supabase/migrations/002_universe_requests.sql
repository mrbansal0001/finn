-- NSE equity list for search/validation (public), written by the worker.
create table if not exists public.universe (
  symbol text primary key,
  name   text not null
);
alter table public.universe enable row level security;
create policy "public read" on public.universe for select to anon, authenticated using (true);
