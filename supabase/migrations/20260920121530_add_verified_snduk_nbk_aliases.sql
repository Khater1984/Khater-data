-- Verified provider aliases for NBK funds found on Snduk.
insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
select v.fund_id, v.alias_name, v.alias_source, v.match_confidence
from (
  values
    ('national_bank_of_kuwait_al_mizan__nbk_capital_asset_management_egypt','NBK Al-Mizan Balanced Fund','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('national_bank_of_kuwait_hayat__nbk_capital_asset_management_egypt','Al Hayah NBK Islamic Fund','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('national_bank_of_kuwait_fund_ishraq__nbk_capital_asset_management_egypt','Ishraq Money Market Fund - NBK','snduk:verified_identity:2026-09-20',1.0::numeric),
    ('national_bank_of_kuwait_fund_namaa__nbk_capital_asset_management_egypt','Namaa Equity Fund - NBK EGYPT','snduk:verified_identity:2026-09-20',1.0::numeric)
) as v(fund_id, alias_name, alias_source, match_confidence)
where not exists (
  select 1
  from public.fund_name_aliases a
  where a.fund_id=v.fund_id and a.alias_name=v.alias_name
);
