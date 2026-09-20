-- Correct known AAIM identity contamination and restore source-backed official NAV.
-- The six affected staging rows are retained and rejected for audit.

update public.nav_staging
set verification_status='rejected',
    notes='Rejected: AAIM parser identity bug mapped the provider label to the wrong canonical fund. Superseded by strict provider-label mapping.'
where id in (11278,11279,11280,11286,11288,11292);

delete from public.fund_price_history
where (fund_id='misr_money_market_egp__ci_asset_management'
       and as_of_date='2026-09-19' and source_id='src_aaim_funds')
   or (fund_id='sarwaty__ci_asset_management'
       and as_of_date='2026-09-19' and source_id='src_aaim_funds');

with s as (
  insert into public.nav_staging
    (run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
  values
    ('repair_20260920_aaim_identity','arab_african_international_bank_juman__arab_african_investment_management','Juman Money Market','Arab African International Bank (Juman)',804.3725,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/juman','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","reason":"correct_provider_identity"}'),
    ('repair_20260920_aaim_identity','arab_african_international_bank_shield__arab_african_investment_management','Shield Equity','Arab African International Bank (Shield)',870.89,'EGP','2026-09-12','https://www.aaim.com.eg/en/what-we-offer/funds','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","reason":"correct_provider_identity"}'),
    ('repair_20260920_aaim_identity','fanar__arab_african_investment_management','El Fanar Money Market','Fanar',177.23143,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/elfanar','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","reason":"correct_provider_identity"}'),
    ('repair_20260920_aaim_identity','misr_takaful__arab_african_investment_management','Misr Takaful Sharia Compliant - Money Market','Misr Takaful',214.29813,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/misr-takaful','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","reason":"correct_provider_identity"}'),
    ('repair_20260920_aaim_identity','sarwaty__arab_african_investment_management','Sarwaty Money Market','Sarwaty*',224.72095,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/sarwaty','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","reason":"correct_provider_identity"}')
  returning id,fund_id
)
update public.nav_official n
set nav=case s.fund_id
    when 'arab_african_international_bank_juman__arab_african_investment_management' then 804.3725
    when 'arab_african_international_bank_shield__arab_african_investment_management' then 870.89
    when 'fanar__arab_african_investment_management' then 177.23143
    when 'misr_takaful__arab_african_investment_management' then 214.29813
    when 'sarwaty__arab_african_investment_management' then 224.72095 end,
    currency='EGP',
    as_of_date=case s.fund_id
      when 'arab_african_international_bank_juman__arab_african_investment_management' then '2026-09-16'::date
      when 'arab_african_international_bank_shield__arab_african_investment_management' then '2026-09-12'::date
      when 'fanar__arab_african_investment_management' then '2026-09-16'::date
      when 'misr_takaful__arab_african_investment_management' then '2026-09-16'::date
      when 'sarwaty__arab_african_investment_management' then '2026-09-16'::date end,
    source_id='src_aaim_funds',
    source_url=case s.fund_id
      when 'arab_african_international_bank_juman__arab_african_investment_management' then 'https://www.aaim.com.eg/en/what-we-offer/funds/juman'
      when 'arab_african_international_bank_shield__arab_african_investment_management' then 'https://www.aaim.com.eg/en/what-we-offer/funds'
      when 'fanar__arab_african_investment_management' then 'https://www.aaim.com.eg/en/what-we-offer/funds/elfanar'
      when 'misr_takaful__arab_african_investment_management' then 'https://www.aaim.com.eg/en/what-we-offer/funds/misr-takaful'
      when 'sarwaty__arab_african_investment_management' then 'https://www.aaim.com.eg/en/what-we-offer/funds/sarwaty' end,
    staging_id=s.id, verified_at=now()
from s
where n.fund_id=s.fund_id;

with s as (
  insert into public.nav_staging
    (run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
  values
    ('repair_20260920_snduk_identity','misr_money_market_egp__ci_asset_management','Banque Misr Day by Day Fund Daily Cumulative Return','Misr Money Market',115.4657,'EGP','2026-09-17','https://snduk.com/eg/funds/banque-misr-day-by-day-fund?lang=en','src_snduk','matched',1.0,'accepted','{"repair":"verified_snduk_identity","date_provenance":"snduk","reason":"replace_known_wrong_aaim_mapping"}')
  returning id
)
update public.nav_official n
set nav=115.4657,currency='EGP',as_of_date='2026-09-17',
    source_id='src_snduk',
    source_url='https://snduk.com/eg/funds/banque-misr-day-by-day-fund?lang=en',
    staging_id=(select id from s),verified_at=now()
where n.fund_id='misr_money_market_egp__ci_asset_management';

with s as (
  insert into public.nav_staging
    (run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
  values
    ('repair_20260920_eima_rollback','sarwaty__ci_asset_management','EIMA verified historical NAV','Sarwaty',198.20591,'EGP','2025-12-31','https://eima.org.eg/?page_id=1886','src_eima_performance_integrated','matched',1.0,'accepted','{"repair":"remove_known_wrong_aaim_mapping","reason":"restore_last_verified_eima_nav"}')
  returning id
)
update public.nav_official n
set nav=198.20591,currency='EGP',as_of_date='2025-12-31',
    source_id='src_eima_performance_integrated',
    source_url='https://eima.org.eg/?page_id=1886',
    staging_id=(select id from s),verified_at=now()
where n.fund_id='sarwaty__ci_asset_management';
