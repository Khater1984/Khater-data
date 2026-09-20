-- Verified manager-source labels for strict identity resolution.
insert into public.fund_name_aliases
  (fund_id, alias_name, alias_source, match_confidence)
select v.fund_id, v.alias_name, v.alias_source, 1.0::numeric
from (
  values
    ('prime:verified_identity:2026-09-20','aman_micro_finance__prime_investments','** Aman Money Market Fund'),
    ('prime:verified_identity:2026-09-20','ebank_fund_iii_konooz__prime_investments','Konooz'),
    ('prime:verified_identity:2026-09-20','egyptian_gulf_bank_tharaa__prime_investments','Tharaa'),
    ('prime:verified_identity:2026-09-20','prime_nmow__prime_investments','Prime NMW'),
    ('ni:verified_identity:2026-09-20','siula_money_market__ni_capital','SIULA MONEY MARKET FUND'),
    ('ni:verified_identity:2026-09-20','ni_capital_15_30__ni_capital','15/30 Fixed Income Fund'),
    ('ni:verified_identity:2026-09-20','gig_makaseb_fund_first_tranche__ni_capital','MAKASEB 1st Tranche'),
    ('ni:verified_identity:2026-09-20','gig_makaseb_fund_second_tranche__ni_capital','MAKASEB 2nd Tranche'),
    ('ni:verified_identity:2026-09-20','ni_capital_sahmy_fund__ni_capital','SAHMY FUND'),
    ('ni:verified_identity:2026-09-20','ni_capital_egx_70__ni_capital','SAHMY 70 FUND'),
    ('ni:verified_identity:2026-09-20','the_charitable_education_fund__ni_capital','EDUCATION FOR LIFE'),
    ('hc:verified_identity:2026-09-20','suez_canal_bank_fund_i__hc_securities_investment','Suez Canal Bank Fund No. 1'),
    ('hc:verified_identity:2026-09-20','agricultural_bank_of_egypt_al_hasad_al_yaumy__hc_securities_investment','Agricultural Bank of Egypt Fund No. 2 (Al Hasad Al Yaumy)'),
    ('hc:verified_identity:2026-09-20','qnb_alahli_tadawol__hc_securities_investment','QNB (Tadawol)'),
    ('hc:verified_identity:2026-09-20','misr_al_mostakbal_fund__hc_securities_investment','Misr Al Mostakbal Company Investment Fund'),
    ('hc:verified_identity:2026-09-20','credit_agricole_egypt_fund_iv_al_thiqa__hc_securities_investment','Credit Agricole Bank Egypt Balanced Fund No. 4'),
    ('hc:verified_identity:2026-09-20','fab_misr_al_awal__hc_securities_investment','FAB Misr (Al Awal) Daily Cumulative Return Fund for Liquidity'),
    ('hc:verified_identity:2026-09-20','fab_misr_fund_etm_nan__hc_securities_investment','FAB Misr (Etm’nan) Capital Preservation Fund')
) as v(alias_source,fund_id,alias_name)
where not exists (
  select 1 from public.fund_name_aliases a
  where a.fund_id=v.fund_id and a.alias_name=v.alias_name
);
