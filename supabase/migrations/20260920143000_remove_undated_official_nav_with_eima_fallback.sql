-- Replace legacy undated official NAV rows with the latest exact EIMA weekly observation
-- when fund identity and currency agree. Never invent a date.
update public.fund_performance_history
set currency='USD'
where fund_id='maksab_first_tranche_usd__x'
  and source_id='src_eima_weekly_tw'
  and upper(coalesce(currency,''))='EGP';

insert into public.nav_staging
  (run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select
  'repair_20260920_dated_eima_official',
  f.fund_id,
  f.canonical_name,
  f.canonical_name,
  p.nav_value,
  f.currency,
  p.report_date,
  coalesce(
    p.raw->>'source_url',
    'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'
  ),
  'src_eima_weekly_tw',
  'matched',
  1.0,
  'accepted',
  jsonb_build_object(
    'repair','remove_undated_official_nav',
    'fallback',true,
    'provenance','eima_weekly_official_industry_report',
    'identity_match','exact_fund_id',
    'frequency_provenance','weekly',
    'source_report_date',p.report_date,
    'source_pdf_name',p.raw->>'pdf_name',
    'source_management_company',p.raw->>'management_company'
  )
from public.funds f
join public.nav_official n
  on n.fund_id=f.fund_id
 and n.as_of_date is null
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
  select 1
  from public.nav_staging s
  where s.run_id='repair_20260920_dated_eima_official'
    and s.fund_id=f.fund_id
);

update public.nav_official n
set nav=s.nav,
    currency=s.currency,
    as_of_date=s.as_of_date,
    source_id=s.source_id,
    source_url=s.source_url,
    staging_id=s.id,
    verified_at=now()
from public.nav_staging s
where s.run_id='repair_20260920_dated_eima_official'
  and s.fund_id=n.fund_id;
