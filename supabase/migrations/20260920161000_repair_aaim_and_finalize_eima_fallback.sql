-- Idempotent repair: retain rejected AAIM identity rows and restore source-backed NAVs.
update public.nav_staging
set verification_status='rejected',
    notes='Rejected: AAIM parser identity bug mapped the provider label to the wrong canonical fund. Superseded by strict provider-label mapping.'
where id in (11278,11279,11280,11286,11288,11292);

delete from public.fund_price_history
where (fund_id='misr_money_market_egp__ci_asset_management'
       and as_of_date='2026-09-19' and source_id='src_aaim_funds')
   or (fund_id='sarwaty__ci_asset_management'
       and as_of_date='2026-09-19' and source_id='src_aaim_funds');

insert into public.nav_official
  (fund_id,nav,currency,as_of_date,source_id,source_url,staging_id,verified_at)
select s.fund_id,s.nav,s.currency,s.as_of_date,s.source_id,s.source_url,s.id,now()
from public.nav_staging s
where s.run_id='repair_20260920_eima_fallback'
on conflict (fund_id) do update
set nav=excluded.nav,
    currency=excluded.currency,
    as_of_date=excluded.as_of_date,
    source_id=excluded.source_id,
    source_url=excluded.source_url,
    staging_id=excluded.staging_id,
    verified_at=excluded.verified_at
where public.nav_official.as_of_date is null
   or excluded.as_of_date >= public.nav_official.as_of_date;
