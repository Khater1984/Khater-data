-- Final post-20260920142328 stage-2 NAV reconciliation.
-- This migration is idempotent and contains only changes made after the last
-- applied migration. It never invents a source date.

begin;

-- Correct the canonical currency recorded for the EIMA USD fund history.
update public.fund_performance_history
set currency='USD'
where fund_id='maksab_first_tranche_usd__x'
  and source_id='src_eima_weekly_tw'
  and upper(coalesce(currency,''))='EGP';

-- Register Alpha/Odin as a manager-scoped source and repair the two fund identities.
update public.funds
set management_company='Alpha Financial Investments Management'
where fund_id in ('delta_life_insurance__x','odin_trend__x')
  and management_company is null;

update public.sources
set management_company_scope='Alpha Financial Investments Management',
    source_kind='management_company_page'
where source_id='src_alpha_odin';

insert into public.fund_name_aliases
  (fund_id,alias_name,alias_source,match_confidence)
select v.fund_id,v.alias_name,v.alias_source,1.0
from (values
  ('delta_life_insurance__x','Delta Life Assurance Fund','alpha:verified_identity:2026-09-20'),
  ('odin_trend__x','Odin Equity Fund Trend','alpha:verified_identity:2026-09-20')
) v(fund_id,alias_name,alias_source)
where not exists (
  select 1 from public.fund_name_aliases a
  where a.fund_id=v.fund_id and a.alias_name=v.alias_name
);

-- Retain only Snduk observations backed by a direct Snduk fund URL or a
-- verified Snduk alias.
delete from public.fund_price_history h
using public.funds f
where h.source_id='src_snduk'
  and coalesce(f.price_update_url,'') not ilike '%snduk.com%'
  and not exists (
    select 1 from public.fund_name_aliases a
    where a.fund_id=h.fund_id
      and a.alias_source like 'snduk:verified_identity:%'
      and a.match_confidence>=1.0
  );

-- Exact Snduk fallback for Banque Misr Day-by-Day / CI Misr Money Market.
insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select *
from (values
('repair_20260920_authorized_snduk',
 'misr_money_market_egp__ci_asset_management',
 'Banque Misr Day by Day Fund Daily Cumulative Return','Misr Money Market',
 115.4657,'EGP','2026-09-17',
 'https://snduk.com/eg/funds/banque-misr-day-by-day-fund?lang=en',
 'src_snduk','matched',1.0,'accepted',
 '{"fallback":true,"provenance":"third_party_snduk","date_provenance":"snduk","frequency_provenance":"snduk_published_frequency","identity_match":"explicit_alias"}'::jsonb),
('repair_20260920_authorized_snduk',
 'mubasher_equity__mubasher_asset_management',
 'Mubasher Equity Fund','Mubasher Equity',
 2.0481,'EGP','2026-09-13',
 'https://snduk.com/eg/funds/mubasher-equity-fund?lang=en',
 'src_snduk','matched',1.0,'accepted',
 '{"fallback":true,"provenance":"third_party_snduk","date_provenance":"snduk","frequency_provenance":"snduk_published_frequency","identity_match":"explicit_alias"}'::jsonb)
) v(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
where not exists (
  select 1 from public.nav_staging s
  where s.run_id=v.run_id and s.fund_id=v.fund_id
);

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id=s.source_id,source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_authorized_snduk'
  and s.fund_id=n.fund_id;

-- Replace the remaining legacy/unverified Snduk officials with the latest
-- exact EIMA weekly observation for the same fund_id and currency.
delete from public.fund_price_history h
where h.source_id='src_snduk'
  and h.fund_id in (
    'al_ahli_bank_of_kuwait_egypt_fund_ii__sigma_asset_management',
    'banque_misr_fund_ii__ci_asset_management',
    'banque_misr_fund_iii__ci_asset_management',
    'ciam_8th_issue_ipos__ci_asset_management',
    'ciam_misr_equity__ci_asset_management',
    'egyptian_arab_land_bank_fund_al_masry__x',
    'misr_al_mostakbal_fund__hc_securities_investment',
    'national_bank_of_egypt_fund_i__x',
    'national_bank_of_egypt_fund_v__x',
    'sigma_traded_fund__x',
    'zaldi_el_masry__zaldi_investments',
    'zaldi_star__zaldi_investments'
  );

insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select
  'repair_20260920_authorized_eima',
  f.fund_id,f.canonical_name,f.canonical_name,p.nav_value,f.currency,p.report_date,
  coalesce(p.raw->>'source_url','https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  'src_eima_weekly_tw','matched',1.0,'accepted',
  jsonb_build_object(
    'fallback',true,
    'provenance','eima_weekly_official_industry_report',
    'identity_match','exact_fund_id',
    'frequency_provenance','weekly',
    'source_report_date',p.report_date
  )
from public.funds f
join public.nav_official n on n.fund_id=f.fund_id
join lateral (
  select p.report_date,p.nav_value,p.raw
  from public.fund_performance_history p
  where p.fund_id=f.fund_id
    and p.source_id='src_eima_weekly_tw'
    and p.nav_value is not null
    and upper(coalesce(p.currency,''))=upper(coalesce(f.currency,''))
  order by p.report_date desc,p.id desc
  limit 1
) p on true
where f.fund_id in (
  'al_ahli_bank_of_kuwait_egypt_fund_ii__sigma_asset_management',
  'banque_misr_fund_ii__ci_asset_management',
  'banque_misr_fund_iii__ci_asset_management',
  'ciam_8th_issue_ipos__ci_asset_management',
  'ciam_misr_equity__ci_asset_management',
  'egyptian_arab_land_bank_fund_al_masry__x',
  'misr_al_mostakbal_fund__hc_securities_investment',
  'national_bank_of_egypt_fund_i__x',
  'national_bank_of_egypt_fund_v__x',
  'sigma_traded_fund__x',
  'zaldi_el_masry__zaldi_investments',
  'zaldi_star__zaldi_investments'
)
and not exists (
  select 1 from public.nav_staging s
  where s.run_id='repair_20260920_authorized_eima' and s.fund_id=f.fund_id
);

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id=s.source_id,source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_authorized_eima'
  and s.fund_id=n.fund_id;

-- Make every remaining undated official NAV dated only when an exact EIMA
-- weekly record with matching currency exists.
insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select
  'repair_20260920_dated_eima_official',
  f.fund_id,f.canonical_name,f.canonical_name,p.nav_value,f.currency,p.report_date,
  coalesce(p.raw->>'source_url','https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  'src_eima_weekly_tw','matched',1.0,'accepted',
  jsonb_build_object(
    'repair','remove_undated_official_nav',
    'fallback',true,
    'provenance','eima_weekly_official_industry_report',
    'identity_match','exact_fund_id',
    'frequency_provenance','weekly',
    'source_report_date',p.report_date
  )
from public.funds f
join public.nav_official n
  on n.fund_id=f.fund_id and n.as_of_date is null
join lateral (
  select p.report_date,p.nav_value,p.currency,p.raw
  from public.fund_performance_history p
  where p.fund_id=f.fund_id
    and p.source_id='src_eima_weekly_tw'
    and p.nav_value is not null
    and upper(coalesce(p.currency,''))=upper(coalesce(f.currency,''))
  order by p.report_date desc,p.id desc
  limit 1
) p on true
where not exists (
  select 1 from public.nav_staging s
  where s.run_id='repair_20260920_dated_eima_official' and s.fund_id=f.fund_id
);

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id=s.source_id,source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_dated_eima_official'
  and s.fund_id=n.fund_id;

-- Repair the known AAIM identity contamination observed before strict matching.
insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
values
('repair_20260920_aaim_identity','arab_african_international_bank_juman__arab_african_investment_management','Juman Money Market','Arab African International Bank (Juman)',804.3725,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/juman','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","identity_match":"exact_provider_alias"}'),
('repair_20260920_aaim_identity','arab_african_international_bank_shield__arab_african_investment_management','Shield Equity','Arab African International Bank (Shield)',870.89,'EGP','2026-09-12','https://www.aaim.com.eg/en/what-we-offer/funds','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","identity_match":"exact_provider_alias"}'),
('repair_20260920_aaim_identity','fanar__arab_african_investment_management','El Fanar Money Market','Fanar',177.23143,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/elfanar','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","identity_match":"exact_provider_alias"}'),
('repair_20260920_aaim_identity','misr_takaful__arab_african_investment_management','Misr Takaful Sharia Compliant - Money Market','Misr Takaful',214.29813,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/misr-takaful','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","identity_match":"exact_provider_alias"}'),
('repair_20260920_aaim_identity','sarwaty__arab_african_investment_management','Sarwaty Money Market','Sarwaty*',224.72095,'EGP','2026-09-16','https://www.aaim.com.eg/en/what-we-offer/funds/sarwaty','src_aaim_funds','matched',1.0,'accepted','{"repair":"strict_aaim_identity","identity_match":"exact_provider_alias"}')
on conflict do nothing;

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id=s.source_id,source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_aaim_identity'
  and s.fund_id=n.fund_id;

-- Restore two funds whose old AAIM mis-map had contaminated a different manager.
delete from public.fund_price_history
where (fund_id='siula_money_market__ni_capital' and source_id='src_aaim_funds')
   or (fund_id='national_bank_of_egypt_fund_iii__x' and source_id='src_hc_si')
   or (fund_id='misr_money_market_egp__ci_asset_management' and source_id='src_aaim_funds')
   or (fund_id='sarwaty__ci_asset_management' and source_id='src_aaim_funds');

insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
values
('repair_20260920_identity_audit','siula_money_market__ni_capital','Siula Money Market','Siula Money Market',24.68231,'EGP','2026-09-03','https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','src_eima_weekly_tw','matched',1.0,'accepted','{"repair":"cross_manager_contamination","provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'),
('repair_20260920_identity_audit','national_bank_of_egypt_fund_iii__x','National Bank of Egypt Fund III','National Bank of Egypt Fund III',648.55,'EGP','2026-09-03','https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','src_eima_weekly_tw','matched',1.0,'accepted','{"repair":"cross_manager_contamination","provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'),
('repair_20260920_identity_audit','sarwaty__ci_asset_management','Sarwaty','Sarwaty',198.20591,'EGP','2025-12-31','https://eima.org.eg/?page_id=1886','src_eima_performance_integrated','matched',1.0,'accepted','{"repair":"lineage_cleanup","provenance":"eima_industry_association_historical_report","identity_match":"exact_fund_id","frequency_provenance":"historical_weekly"}')
on conflict do nothing;

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id=s.source_id,source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_identity_audit'
  and s.fund_id=n.fund_id;

-- Recreate lineage for existing official rows only when an unambiguous matching
-- staging record already exists.
update public.nav_official n
set staging_id=s.id
from public.nav_staging s
where n.staging_id is null
  and s.fund_id=n.fund_id
  and s.as_of_date=n.as_of_date
  and s.source_id=n.source_id
  and s.nav=n.nav
  and s.currency=n.currency
  and (
    select count(*)
    from public.nav_staging sx
    where sx.fund_id=n.fund_id
      and sx.as_of_date=n.as_of_date
      and sx.source_id=n.source_id
      and sx.nav=n.nav
      and sx.currency=n.currency
  )=1;

-- Backfill lineage for the Alpha/Odin manager rows from their existing official record.
insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select
  'backfill_20260920_official_lineage',
  n.fund_id,f.canonical_name,f.canonical_name,n.nav,n.currency,n.as_of_date,n.source_url,n.source_id,
  'matched',1.0,'accepted',
  '{"lineage_mode":"backfill_of_existing_official","identity_match":"exact_fund_id","source_backed":true}'::jsonb
from public.nav_official n
join public.funds f using(fund_id)
where n.staging_id is null
  and n.source_id='src_alpha_odin'
  and not exists (
    select 1 from public.nav_staging s
    where s.run_id='backfill_20260920_official_lineage' and s.fund_id=n.fund_id
  );

update public.nav_official n
set staging_id=s.id
from public.nav_staging s
where n.staging_id is null
  and s.run_id='backfill_20260920_official_lineage'
  and s.fund_id=n.fund_id;

commit;
