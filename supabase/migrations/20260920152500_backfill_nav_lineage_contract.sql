begin;

insert into public.nav_staging
(run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select
  'backfill_20260920_lineage_contract',
  n.fund_id,
  f.canonical_name,
  f.canonical_name,
  n.nav,
  n.currency,
  n.as_of_date,
  n.source_url,
  n.source_id,
  'matched',
  1.0,
  'accepted',
  jsonb_build_object(
    'lineage_mode','backfill_of_existing_official',
    'identity_match','exact_fund_id',
    'source_backed',true,
    'source_id',n.source_id,
    'backfilled_at','2026-09-20'
  )
from public.nav_official n
join public.funds f using(fund_id)
left join public.nav_staging s on s.id=n.staging_id
where n.as_of_date is not null
  and n.nav is not null
  and n.staging_id is not null
  and (
    s.id is null
    or s.fund_id is distinct from n.fund_id
    or s.nav is distinct from n.nav
    or s.currency is distinct from n.currency
    or s.as_of_date is distinct from n.as_of_date
    or s.source_id is distinct from n.source_id
  )
  and not exists (
    select 1 from public.nav_staging x
    where x.run_id='backfill_20260920_lineage_contract'
      and x.fund_id=n.fund_id
  );

update public.nav_official n
set staging_id=x.id
from public.nav_staging x
where x.run_id='backfill_20260920_lineage_contract'
  and x.fund_id=n.fund_id;

commit;