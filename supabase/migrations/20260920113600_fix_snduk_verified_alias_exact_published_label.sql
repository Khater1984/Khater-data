-- Keep the Snduk fallback identity registry exact to the provider's published label.
delete from public.fund_name_aliases
where fund_id='misr_money_market_euro__ci_asset_management'
  and alias_source like 'snduk:verified_identity:%';

insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
values
  ('misr_money_market_euro__ci_asset_management',
   'Banque Misr Mutual Fund in Euro ( day by day Euro )',
   'snduk:verified_identity:2026-09-20',
   1.0);
