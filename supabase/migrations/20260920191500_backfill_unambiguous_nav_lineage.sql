-- Backfill only unambiguous NAV staging lineage.
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
