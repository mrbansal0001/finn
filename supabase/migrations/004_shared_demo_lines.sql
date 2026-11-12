-- 004: demo visitors read the demo network lines from the template instead of a private copy each.
-- Run once in the Supabase SQL editor, after 003.
--
-- Why: every anonymous visitor got ~535 copied rows and every worker cycle rewrote all of them
-- (346 visitors -> 208,984 rows; the refresh hit the statement timeout on 12 Nov). The demo lines are
-- identical for every demo visitor, so a copy per visitor isolates nothing. Each visitor still gets
-- a private copy of the contacts (that is what row-level security demonstrates), and a real user's own
-- computed lines would live in network_lines, readable only by that owner, exactly as before.

-- 1. A visitor's lines: their own rows if they have any (a real user), else the demo template, but only
--    for a signed-in visitor who has a demo network. Anonymous (no session) callers get nothing.
create or replace function public.my_network_lines() returns table (card_id text, lines jsonb)
  language sql stable security definer set search_path = '' as $$
  select l.card_id, l.lines from public.network_lines l where l.owner_id = (select auth.uid())
  union all
  select d.card_id, d.lines from public.demo_network_lines d
   where exists (select 1 from public.contacts c where c.owner_id = (select auth.uid()))
     and not exists (select 1 from public.network_lines l where l.owner_id = (select auth.uid()))
$$;
revoke execute on function public.my_network_lines() from public, anon;
grant execute on function public.my_network_lines() to authenticated;

-- 2. New visitors: contacts and edges only.
create or replace function public.seed_demo_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.contacts (owner_id, id, name, profile, interactions_12m, last_contact, reciprocity, rating)
    select new.id, d.id, d.name, d.profile, d.interactions_12m, d.last_contact, d.reciprocity, d.rating
    from public.demo_contacts d;
  insert into public.contact_edges (owner_id, a, b, strength, context)
    select new.id, e.a, e.b, e.strength, e.context from public.demo_edges e;
  return new;
end $$;

-- 3. Nothing to re-copy any more; kept so an older worker's call succeeds.
create or replace function public.refresh_demo_network_lines() returns integer
  language sql security definer set search_path = '' as $$ select 0 $$;
revoke execute on function public.refresh_demo_network_lines() from public, anon, authenticated;

-- 4. The copies made so far are all demo copies: remove them.
truncate public.network_lines;

-- 5. Let the worker prune template rows for cards that no longer exist.
alter table public.demo_network_lines add column if not exists refreshed_at timestamptz not null default now();
