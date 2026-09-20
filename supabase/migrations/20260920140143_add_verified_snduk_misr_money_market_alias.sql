insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
select 'misr_money_market_egp__ci_asset_management',
       'Banque Misr Day by Day Fund Daily Cumulative Return',
       'snduk:verified_identity:2026-09-20',
       1.0
where not exists (
  select 1 from public.fund_name_aliases
  where fund_id='misr_money_market_egp__ci_asset_management'
    and alias_name='Banque Misr Day by Day Fund Daily Cumulative Return'
);
