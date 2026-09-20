-- Keep canonical fund currency aligned with verified USD NAV/history provenance.
update public.funds
set currency = 'USD'
where fund_id in (
  'azimut_target_maturity_fund_target_2027_usd__azimut_egypt_asset_management',
  'azimut_target_maturity_fund_target_2029_usd__azimut_egypt_asset_management',
  'azimut_target_maturity_fund_target_2030_usd__azimut_egypt_asset_management',
  'bonds_fixed_income_usd_fund__arab_african_investment_management',
  'maksab_first_tranche_usd__x'
)
and upper(coalesce(currency, '')) <> 'USD';
