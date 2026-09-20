insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
select 'ciam_gold__ci_asset_management',
       'CIAM Gold Fund - Gold Masr ( Islamic Shariah compliant )',
       'snduk:verified_identity:2026-09-20',
       1.0
where not exists (
  select 1 from public.fund_name_aliases
  where fund_id='ciam_gold__ci_asset_management'
    and alias_name='CIAM Gold Fund - Gold Masr ( Islamic Shariah compliant )'
);
