-- Authorize Alpha/Odin manager source and replace legacy unverified Snduk officials
-- with exact Snduk/EIMA observations. All mappings are deterministic by fund_id.

update public.funds
set management_company='Alpha Financial Investments Management'
where fund_id in ('delta_life_insurance__x','odin_trend__x')
  and management_company is null;

update public.sources
set management_company_scope='Alpha Financial Investments Management',
    source_kind='management_company_page'
where source_id='src_alpha_odin';

insert into public.fund_name_aliases (fund_id,alias_name,alias_source,match_confidence)
select 'mubasher_equity__mubasher_asset_management',
       'Mubasher Equity Fund',
       'snduk:verified_identity:2026-09-20',
       1.0
where not exists (
  select 1 from public.fund_name_aliases
  where fund_id='mubasher_equity__mubasher_asset_management'
    and alias_name='Mubasher Equity Fund'
);

delete from public.fund_price_history h
using public.funds f
where h.source_id='src_snduk'
  and h.fund_id=f.fund_id
  and f.fund_id in (
    'al_ahli_bank_of_kuwait_egypt_fund_ii__sigma_asset_management',
    'banque_misr_fund_ii__ci_asset_management',
    'banque_misr_fund_iii__ci_asset_management',
    'ciam_8th_issue_ipos__ci_asset_management',
    'ciam_misr_equity__ci_asset_management',
    'egyptian_arab_land_bank_fund_al_masry__x',
    'misr_al_mostakbal_fund__hc_securities_investment',
    'misr_money_market_egp__ci_asset_management',
    'mubasher_equity__mubasher_asset_management',
    'national_bank_of_egypt_fund_i__x',
    'national_bank_of_egypt_fund_v__x',
    'sigma_traded_fund__x',
    'zaldi_el_masry__zaldi_investments',
    'zaldi_star__zaldi_investments'
  );

insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
values
('repair_20260920_authorized_snduk','misr_money_market_egp__ci_asset_management','Banque Misr Day by Day Fund Daily Cumulative Return','Misr Money Market',115.4657,'EGP','2026-09-17','https://snduk.com/eg/funds/banque-misr-day-by-day-fund?lang=en','src_snduk','matched',1.0,'accepted','{"fallback":true,"provenance":"third_party_snduk","date_provenance":"snduk","frequency_provenance":"snduk_published_frequency","identity_match":"explicit_alias"}'::jsonb),
('repair_20260920_authorized_snduk','mubasher_equity__mubasher_asset_management','Mubasher Equity Fund','Mubasher Equity',2.0481,'EGP','2026-09-13','https://snduk.com/eg/funds/mubasher-equity-fund?lang=en','src_snduk','matched',1.0,'accepted','{"fallback":true,"provenance":"third_party_snduk","date_provenance":"snduk","frequency_provenance":"snduk_published_frequency","identity_match":"explicit_alias"}'::jsonb)
on conflict do nothing;

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id=s.source_id,source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_authorized_snduk'
  and s.fund_id=n.fund_id;

insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select
  'repair_20260920_authorized_eima',
  v.fund_id,v.canonical_name,v.canonical_name,v.nav,v.currency,v.as_of_date,v.source_url,
  'src_eima_weekly_tw','matched',1.0,'accepted',
  jsonb_build_object(
    'fallback',true,
    'provenance','eima_weekly_official_industry_report',
    'identity_match','exact_fund_id',
    'frequency_provenance','weekly',
    'source_report_date',v.as_of_date
  )
from (values
  ('al_ahli_bank_of_kuwait_egypt_fund_ii__sigma_asset_management','Al Ahli Bank of Kuwait - Egypt Fund II',73.1386::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('banque_misr_fund_ii__ci_asset_management','Banque Misr Fund II',23.77::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('banque_misr_fund_iii__ci_asset_management','Banque Misr Fund III',35.12::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('ciam_8th_issue_ipos__ci_asset_management','CIAM 8th Issue (IPOs)',11.3045::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('ciam_misr_equity__ci_asset_management','CIAM Misr Equity',39.0224::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('egyptian_arab_land_bank_fund_al_masry__x','Egyptian Arab Land Bank Fund (Al Masry)',473.27398::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('misr_al_mostakbal_fund__hc_securities_investment','Misr Al Mostakbal Fund',89.05::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('national_bank_of_egypt_fund_i__x','National Bank of Egypt Fund I',172.36::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('national_bank_of_egypt_fund_v__x','National Bank of Egypt Fund V',57.02::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('sigma_traded_fund__x','Sigma Traded Fund',11.839::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('zaldi_el_masry__zaldi_investments','Zaldi El Masry',13.6::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'),
  ('zaldi_star__zaldi_investments','Zaldi Star',111.6733::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf')
) v(fund_id,canonical_name,nav,currency,as_of_date,source_url)
where not exists (
  select 1 from public.nav_staging s
  where s.run_id='repair_20260920_authorized_eima' and s.fund_id=v.fund_id
);

update public.nav_official n
set nav=s.nav,currency=s.currency,as_of_date=s.as_of_date,
    source_id='src_eima_weekly_tw',source_url=s.source_url,staging_id=s.id,verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_authorized_eima'
  and s.fund_id=n.fund_id;
