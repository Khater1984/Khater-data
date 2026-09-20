-- Verify and register Odin 4 under Alpha for Mutual Funds Management.
update public.funds
set management_company='Alpha Financial Investments Management'
where fund_id='odin_4__x';

insert into public.fund_name_aliases
  (fund_id,alias_name,alias_source,match_confidence)
select 'odin_4__x',
       'Odin Money Market Fund Odin 4',
       'alpha:verified_identity:2026-09-20',
       1.0
where not exists (
  select 1 from public.fund_name_aliases
  where fund_id='odin_4__x'
    and alias_name='Odin Money Market Fund Odin 4'
);

insert into public.fund_name_aliases
  (fund_id,alias_name,alias_source,match_confidence)
select 'odin_4__x',
       'Odin 4 Money Market Fund',
       'snduk:verified_identity:2026-09-20',
       1.0
where not exists (
  select 1 from public.fund_name_aliases
  where fund_id='odin_4__x'
    and alias_name='Odin 4 Money Market Fund'
);
