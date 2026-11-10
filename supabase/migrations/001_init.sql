-- FINN schema. Two kinds of data, two policies (docs/research/04-architecture.md §3, D-020, D-025):
--   PUBLIC market data  : anyone may read; only the worker (service role) writes.
--   PRIVATE investor data: row-level security, each user sees only rows they own.
-- The service-role key lives only on the worker machine and in server-side env.

-- ------------------------------------------------------------------ public market data

create table if not exists public.snapshot (
  id            text primary key default 'current',
  generated_at  timestamptz not null,
  data_until    timestamptz not null,
  payload       jsonb not null            -- editions, results, prices, people-free market view
);

create table if not exists public.ledgers (
  symbol        text primary key,
  provenance    text not null,            -- 'reference (hand-labelled)' | 'model-built'
  built_at      timestamptz not null default now(),
  payload       jsonb not null
);

create table if not exists public.filings (
  id            text primary key,
  symbol        text,
  company_name  text not null,
  subject       text not null,
  summary       text,
  link          text,
  published_at  timestamptz not null,
  category      text,
  tier          text,
  needs_document boolean default false
);
create index if not exists filings_symbol_time on public.filings (symbol, published_at desc);

create table if not exists public.results (
  symbol        text not null,
  period_end    date not null,
  nature        text not null,
  source        text not null,
  source_url    text,
  check_status  text,
  values_json   jsonb not null,
  comparatives  jsonb,
  primary key (symbol, period_end, nature)
);

-- pull requests for tickers not yet covered; the residential worker drains this queue
create table if not exists public.coverage_requests (
  symbol        text primary key,
  requested_at  timestamptz not null default now(),
  status        text not null default 'queued',   -- queued | building | ready | unavailable
  detail        text
);

alter table public.snapshot enable row level security;
alter table public.ledgers enable row level security;
alter table public.filings enable row level security;
alter table public.results enable row level security;
alter table public.coverage_requests enable row level security;

create policy "public read" on public.snapshot for select to anon, authenticated using (true);
create policy "public read" on public.ledgers for select to anon, authenticated using (true);
create policy "public read" on public.filings for select to anon, authenticated using (true);
create policy "public read" on public.results for select to anon, authenticated using (true);
create policy "public read" on public.coverage_requests for select to anon, authenticated using (true);
-- signed-in users (including anonymous demo users) may ask for a ticker; only the worker updates status
create policy "request coverage" on public.coverage_requests for insert to authenticated
  with check (status = 'queued' and detail is null);
-- no insert/update/delete policies otherwise: only the service role (which bypasses RLS) writes.

-- ------------------------------------------------------------------ private investor data

create table if not exists public.contacts (
  owner_id      uuid not null references auth.users (id) on delete cascade,
  id            text not null,
  name          text not null,
  profile       jsonb not null,           -- career, education, domains (never sent to a model)
  interactions_12m int not null default 0,
  last_contact  date,
  reciprocity   real not null default 0,
  rating        smallint not null default 3 check (rating between 1 and 5),
  notes         text,                     -- the investor's private notes
  primary key (owner_id, id)
);

create table if not exists public.contact_edges (
  owner_id      uuid not null references auth.users (id) on delete cascade,
  a             text not null,
  b             text not null,
  strength      text not null,
  context       text,
  primary key (owner_id, a, b)
);

create table if not exists public.network_lines (
  owner_id      uuid not null references auth.users (id) on delete cascade,
  card_id       text not null,            -- edition card id, or 'company:SYM', or 'verify:SYM:T14'
  lines         jsonb not null,
  computed_at   timestamptz not null default now(),
  primary key (owner_id, card_id)
);

create table if not exists public.portfolios (
  owner_id      uuid not null references auth.users (id) on delete cascade,
  symbol        text not null,
  weight        real not null default 0,
  primary key (owner_id, symbol)
);

create table if not exists public.prefs (
  owner_id      uuid primary key references auth.users (id) on delete cascade,
  prefs         jsonb not null
);

do $$
declare t text;
begin
  foreach t in array array['contacts', 'contact_edges', 'network_lines', 'portfolios', 'prefs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    -- (select auth.uid()) is evaluated once per statement, not per row
    execute format($p$create policy "owner only" on public.%I for all to authenticated
                     using ((select auth.uid()) = owner_id)
                     with check ((select auth.uid()) = owner_id)$p$, t);
  end loop;
end $$;

-- ------------------------------------------------------------------ demo seeding

-- The synthetic demo network, readable by nobody directly; copied into each new user's own rows.
create table if not exists public.demo_contacts (id text primary key, name text not null, profile jsonb not null,
  interactions_12m int, last_contact date, reciprocity real, rating smallint);
create table if not exists public.demo_edges (a text, b text, strength text, context text, primary key (a, b));
create table if not exists public.demo_network_lines (card_id text primary key, lines jsonb not null);
alter table public.demo_contacts enable row level security;
alter table public.demo_edges enable row level security;
alter table public.demo_network_lines enable row level security;

create or replace function public.seed_demo_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contacts (owner_id, id, name, profile, interactions_12m, last_contact, reciprocity, rating)
    select new.id, d.id, d.name, d.profile, d.interactions_12m, d.last_contact, d.reciprocity, d.rating
    from public.demo_contacts d;
  insert into public.contact_edges (owner_id, a, b, strength, context)
    select new.id, e.a, e.b, e.strength, e.context from public.demo_edges e;
  insert into public.network_lines (owner_id, card_id, lines)
    select new.id, l.card_id, l.lines from public.demo_network_lines l;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.seed_demo_user();
