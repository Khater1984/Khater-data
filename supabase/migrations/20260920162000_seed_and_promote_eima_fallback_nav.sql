-- Seed exact EIMA weekly fallback rows for funds with no official NAV,
-- then promote them through the same official table contract.
insert into public.nav_staging
  (run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select v.run_id,v.fund_id,v.canonical_name,v.canonical_name,v.nav,v.currency,v.as_of_date,v.source_url,
       'src_eima_weekly_tw','matched',1.0,'accepted',v.raw_payload
from (
  values
    ('repair_20260920_eima_fallback','blom_bank_fund_i__cfh_asset_management','Blom Bank Fund I',601.34::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','{"fallback":true,"provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'::jsonb),
    ('repair_20260920_eima_fallback','blom_bank_fund_ii__cfh_asset_management','Blom Bank Fund II',740.11::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','{"fallback":true,"provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'::jsonb),
    ('repair_20260920_eima_fallback','maksab_second_tranche_euro__alpha_zaldi','Maksab Second Tranche (Euro)',1.07948::numeric,'EUR','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','{"fallback":true,"provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'::jsonb),
    ('repair_20260920_eima_fallback','thndr_gold__x','Thndr Gold',1.09::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','{"fallback":true,"provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'::jsonb)
) as v(run_id,fund_id,canonical_name,nav,currency,as_of_date,source_url,raw_payload)
where not exists (
  select 1 from public.nav_staging s
  where s.run_id=v.run_id and s.fund_id=v.fund_id
);

insert into public.nav_official
  (fund_id,nav,currency,as_of_date,source_id,source_url,staging_id,verified_at)
select s.fund_id,s.nav,s.currency,s.as_of_date,s.source_id,s.source_url,s.id,now()
from public.nav_staging s
where s.run_id='repair_20260920_eima_fallback'
on conflict (fund_id) do update
set nav=excluded.nav,currency=excluded.currency,as_of_date=excluded.as_of_date,
    source_id=excluded.source_id,source_url=excluded.source_url,
    staging_id=excluded.staging_id,verified_at=excluded.verified_at
where public.nav_official.as_of_date is null
   or excluded.as_of_date >= public.nav_official.as_of_date;
