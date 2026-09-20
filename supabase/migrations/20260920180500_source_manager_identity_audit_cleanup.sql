-- Source-manager identity audit cleanup.
update public.nav_staging s
set verification_status='rejected',
    notes=concat(
      coalesce(s.notes,''),
      case when coalesce(s.notes,'')='' then '' else ' | ' end,
      'Rejected by source-manager identity audit: provider source was mapped to a different management company.'
    )
where s.fund_id is not null
  and exists (
    select 1
    from public.funds f
    where f.fund_id=s.fund_id
      and f.management_company is distinct from case s.source_id
        when 'src_aaim_funds' then 'Arab African Investment Management'
        when 'src_hc_si' then 'HC Securities & Investment'
        when 'src_nicapital_am' then 'NI Capital'
        when 'src_prime_am' then 'Prime Investments'
        when 'src_efg_hermes_funds' then 'Hermes Portfolio and Fund Management'
        when 'src_cicapital_fundprice' then 'CI Asset Management'
        else f.management_company
      end
  )
  and s.source_id in (
    'src_aaim_funds','src_hc_si','src_nicapital_am',
    'src_prime_am','src_efg_hermes_funds','src_cicapital_fundprice'
  );

delete from public.fund_price_history
where (fund_id='siula_money_market__ni_capital' and source_id='src_aaim_funds')
   or (fund_id='national_bank_of_egypt_fund_iii__x' and source_id='src_hc_si');

insert into public.nav_staging
  (run_id,fund_id,extracted_name,canonical_name,nav,currency,as_of_date,source_url,source_id,match_status,match_score,verification_status,raw)
select v.run_id,v.fund_id,v.canonical_name,v.canonical_name,v.nav,v.currency,v.as_of_date,v.source_url,
       'src_eima_weekly_tw','matched',1.0,'accepted',v.raw_payload
from (
  values
    ('repair_20260920_identity_audit','siula_money_market__ni_capital','Siula Money Market',24.68231::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','{"repair":"cross_manager_contamination","provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'::jsonb),
    ('repair_20260920_identity_audit','national_bank_of_egypt_fund_iii__x','National Bank of Egypt Fund III',648.55::numeric,'EGP','2026-09-03'::date,'https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf','{"repair":"cross_manager_contamination","provenance":"eima_weekly_official_industry_report","identity_match":"exact_fund_id","frequency_provenance":"weekly"}'::jsonb)
) v(run_id,fund_id,canonical_name,nav,currency,as_of_date,source_url,raw_payload)
where not exists (
  select 1 from public.nav_staging s
  where s.run_id=v.run_id and s.fund_id=v.fund_id
);

insert into public.nav_official
  (fund_id,nav,currency,as_of_date,source_id,source_url,staging_id,verified_at)
select *
from (
  values
    ('siula_money_market__ni_capital',24.68231::numeric,'EGP','2026-09-03'::date,'src_eima_weekly_tw','https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'::text,
     (select id from public.nav_staging where run_id='repair_20260920_identity_audit' and fund_id='siula_money_market__ni_capital' limit 1),now()),
    ('national_bank_of_egypt_fund_iii__x',648.55::numeric,'EGP','2026-09-03'::date,'src_eima_weekly_tw','https://eima.org.eg/wp-content/uploads/2026/09/performance-03-of-September-2026-Time-Weighted.pdf'::text,
     (select id from public.nav_staging where run_id='repair_20260920_identity_audit' and fund_id='national_bank_of_egypt_fund_iii__x' limit 1),now())
) v
on conflict (fund_id) do update
set nav=excluded.nav,currency=excluded.currency,as_of_date=excluded.as_of_date,
    source_id=excluded.source_id,source_url=excluded.source_url,
    staging_id=excluded.staging_id,verified_at=excluded.verified_at
where public.nav_official.as_of_date is null
   or excluded.as_of_date >= public.nav_official.as_of_date;
