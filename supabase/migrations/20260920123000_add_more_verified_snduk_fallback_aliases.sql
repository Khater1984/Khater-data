-- Verified Snduk provider labels for exact third-party fallback identity.
insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
select v.fund_id, v.alias_name, v.alias_source, v.match_confidence
from (
  values
    ('agricultural_bank_of_egypt_al_wefak__ci_asset_management','Al Wefak Shariah Compliant Investment Fund','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('mubasher_equity__mubasher_asset_management','Mubasher Equity Fund','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('siula_money_market__ni_capital','Siula Money Market Fund - NI Capital','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('housing_development_bank_mawared__pfi_asset_management','Mawared Money Market Fund – HD BANK','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('pfi_cashi__pfi_asset_management','PFI Cashi Money Market Fund','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('odin_trend__x','Odin Equity Fund Trend','snduk:verified_identity:2026-09-20',1.0::numeric)
) as v(fund_id, alias_name, alias_source, match_confidence)
where not exists (
  select 1
  from public.fund_name_aliases a
  where a.fund_id=v.fund_id and a.alias_name=v.alias_name
);
