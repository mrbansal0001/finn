-- 006: hardening from the 14 Nov full submission review (F08, F13). Run once in the SQL editor, after 005.

-- 1. Push endpoints are outbound requests from the worker, so only browser push services are accepted (F08).
--    The worker checks the same list again at send time.
alter table public.push_subscriptions drop constraint if exists push_endpoint_is_a_push_service;
alter table public.push_subscriptions add constraint push_endpoint_is_a_push_service check (
  endpoint ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)/'
  and length(endpoint) < 1000
);
alter table public.push_subscriptions drop constraint if exists push_keys_shape;
alter table public.push_subscriptions add constraint push_keys_shape check (
  p256dh ~ '^[A-Za-z0-9_-]{87}=*$' and auth ~ '^[A-Za-z0-9_-]{22}=*$'
);
alter table public.push_subscriptions drop constraint if exists push_prefs_is_an_object;
alter table public.push_subscriptions add constraint push_prefs_is_an_object check (jsonb_typeof(prefs) = 'object');

-- 2. A visitor may change their rules only. The delivery cursors (last_session, last_filing_at), the endpoint and
--    the keys belong to the worker and the browser; the row-level policy limits which rows, this limits which columns.
revoke update on public.push_subscriptions from authenticated, anon;
grant update (prefs) on public.push_subscriptions to authenticated;

-- 3. One company's passages are replaced in one transaction (F13): readers see the old set or the new one, never a
--    company with its rows deleted and not yet reinserted, or passages indexed against another version's sources.
create or replace function public.replace_company_passages(sym text, srcs jsonb, rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  delete from public.passages where symbol = sym;
  delete from public.passage_sources where symbol = sym;
  insert into public.passage_sources (symbol, i, label, url, n)
    select sym, (x->>'i')::int, x->>'label', x->>'url', (x->>'n')::int from jsonb_array_elements(srcs) x;
  insert into public.passages (symbol, i, s, page, who, role, body)
    select sym, (x->>'i')::int, (x->>'s')::int, (x->>'page')::int, nullif(x->>'who', ''), coalesce(x->>'role', ''), x->>'body'
    from jsonb_array_elements(rows) x;
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.replace_company_passages(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.replace_company_passages(text, jsonb, jsonb) to service_role;
