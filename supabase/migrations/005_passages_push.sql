-- 005: "Ask the documents" and push at the close (brief-check plan, parts 5 and 1). Run once in the SQL editor.

-- 1. Passages: the paragraphs of each covered company's last four call transcripts and its annual report's
--    MD&A, with page and speaker. Public company documents, so public read. Searched in Postgres with a
--    full-text index; nothing here goes to a model, so an answer can only be the company's own words.
create table if not exists public.passage_sources (
  symbol text not null,
  i      int  not null,           -- source number within the company
  label  text not null,           -- "Aug 2026 call", "FY26 annual report"
  url    text not null,
  n      int  not null,           -- passages read from it; 0 = a scan with no text layer
  primary key (symbol, i)
);
create table if not exists public.passages (
  symbol text not null,
  i      int  not null,           -- passage number within the company
  s      int  not null,           -- source number
  page   int  not null,
  who    text,                    -- speaker; null for the annual report
  role   text not null,           -- m = management, a = analyst, r = annual report, '' = not known
  body   text not null,
  tsv    tsvector generated always as (to_tsvector('english', body)) stored,
  primary key (symbol, i)
);
create index if not exists passages_tsv on public.passages using gin (tsv);
alter table public.passage_sources enable row level security;
alter table public.passages enable row level security;
create policy "public read" on public.passage_sources for select to anon, authenticated using (true);
create policy "public read" on public.passages for select to anon, authenticated using (true);

-- The question's words, all of them first (AND); if fewer than three passages carry them all, any of them
-- (OR). Passages that cover more of the question's words come first, then cover density (words close
-- together), with the company's own answers above analysts' questions. Returns the words each passage
-- matched and how many the question had, so the app can refuse when no passage covers the question.
create or replace function public.ask_passages(sym text, q text, k int default 5)
returns table (i int, s int, page int, who text, role text, body text, snippet text, rank real, mode text,
               matched text[], terms int)
language plpgsql stable set search_path = '' as $$
declare
  qa tsquery := websearch_to_tsquery('english', left(q, 200));
  qo tsquery;
  n  int;
  lex text[] := tsvector_to_array(to_tsvector('english', left(q, 200)));
begin
  if numnode(qa) = 0 then return; end if;
  select count(*) into n from public.passages p where p.symbol = sym and p.tsv @@ qa;
  if n < 3 then
    qo := replace(qa::text, '&', '|')::tsquery;
  end if;
  return query
    select p.i, p.s, p.page, p.who, p.role, p.body,
           ts_headline('english', p.body, coalesce(qo, qa),
                       'StartSel=<<, StopSel=>>, MaxWords=45, MinWords=20, MaxFragments=2, FragmentDelimiter=" … "'),
           (ts_rank_cd(p.tsv, coalesce(qo, qa), 32)
             * case p.role when 'm' then 1.3 when 'r' then 1.1 when 'a' then 0.6 else 1.0 end)::real,
           case when qo is null then 'all' else 'any' end,
           array(select unnest(lex) intersect select unnest(tsvector_to_array(p.tsv))),
           cardinality(lex)
    from public.passages p
    where p.symbol = sym and p.tsv @@ coalesce(qo, qa)
    order by cardinality(array(select unnest(lex) intersect select unnest(tsvector_to_array(p.tsv)))) desc, 8 desc
    limit least(greatest(k, 1), 8);
end $$;
grant execute on function public.ask_passages(text, text, int) to anon, authenticated;

-- 2. Push subscriptions: a browser's push endpoint and the visitor's alert rules, in the visitor's own private
--    rows. The worker (service role) reads them at the close and sends; nothing else can read them. They go
--    when the anonymous session is purged (14 days, migration 003) through the cascade.
create table if not exists public.push_subscriptions (
  endpoint       text primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  p256dh         text not null,
  auth           text not null,
  prefs          jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  last_session   text,            -- the last close a digest was sent for
  last_filing_at timestamptz      -- filings after this are new for this subscriber
);
alter table public.push_subscriptions enable row level security;
alter table public.push_subscriptions force row level security;

create or replace function public.my_push_count() returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.push_subscriptions where user_id = (select auth.uid())
$$;
revoke execute on function public.my_push_count() from public, anon;
grant execute on function public.my_push_count() to authenticated;

create policy "own rows: read" on public.push_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own rows: subscribe" on public.push_subscriptions for insert to authenticated
  with check (user_id = (select auth.uid()) and length(endpoint) < 1000 and endpoint like 'https://%'
              and length(p256dh) < 200 and length(auth) < 100 and pg_column_size(prefs) < 4000
              and last_session is null and last_filing_at is null
              and public.my_push_count() < 3);
create policy "own rows: update rules" on public.push_subscriptions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and pg_column_size(prefs) < 4000);
create policy "own rows: unsubscribe" on public.push_subscriptions for delete to authenticated
  using (user_id = (select auth.uid()));
