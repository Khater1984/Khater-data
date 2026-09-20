-- NAV history must never invent an as_of_date when the source did not publish one.
-- Source-published bounded future dates remain valid.
create or replace function public.log_nav_official_to_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.as_of_date is null then
    return new;
  end if;

  insert into public.fund_price_history
    (fund_id, nav, currency, as_of_date, source_id)
  values
    (new.fund_id, new.nav, new.currency, new.as_of_date, new.source_id)
  on conflict (fund_id, as_of_date) do update
    set nav = excluded.nav,
        currency = excluded.currency,
        source_id = excluded.source_id,
        recorded_at = now();

  return new;
end;
$function$;

insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
values
  ('misr_money_market_euro__ci_asset_management',
   'Banque Misr Mutual Fund in Euro',
   'snduk:verified_identity:2026-09-19',
   1.0)
on conflict do nothing;
