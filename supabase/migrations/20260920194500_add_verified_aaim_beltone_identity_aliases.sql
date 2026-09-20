-- Verified AAIM and Beltone provider labels for strict identity resolution.
insert into public.fund_name_aliases (fund_id, alias_name, alias_source, match_confidence)
select v.fund_id, v.alias_name, v.alias_source, 1.0::numeric
from (values
  ('aaib_gozoor__arab_african_investment_management','Gozoor Fixed Income (EGP)','aaim:verified_identity:2026-09-20'),
  ('afaaq__arab_african_investment_management','Afaaq Fixed Income (EGP)','aaim:verified_identity:2026-09-20'),
  ('arab_african_international_bank_guard__arab_african_investment_management','Guard Capital Protection','aaim:verified_identity:2026-09-20'),
  ('arab_african_international_bank_juman__arab_african_investment_management','Juman Money Market','aaim:verified_identity:2026-09-20'),
  ('arab_african_international_bank_shield__arab_african_investment_management','Shield Equity','aaim:verified_identity:2026-09-20'),
  ('bareeq__arab_african_investment_management','Bareeq Fixed Income (EGP)','aaim:verified_identity:2026-09-20'),
  ('bonds_fixed_income_usd_fund__arab_african_investment_management','Bond$ Fixed Income (USD)','aaim:verified_identity:2026-09-20'),
  ('diamond__arab_african_investment_management','Diamond Money Market','aaim:verified_identity:2026-09-20'),
  ('fanar__arab_african_investment_management','El Fanar Money Market','aaim:verified_identity:2026-09-20'),
  ('gosour_equity__arab_african_investment_management','Gosour Equity','aaim:verified_identity:2026-09-20'),
  ('housing_development_bank_al_tameer__arab_african_investment_management','Al Tameer Equity','aaim:verified_identity:2026-09-20'),
  ('iskan_insurance__arab_african_investment_management','Iskan Money Market','aaim:verified_identity:2026-09-20'),
  ('kenoz_egx33_shariah_index_tracker_shariah__arab_african_investment_management','Kenz Shariah Sharia Compliant - Equity','aaim:verified_identity:2026-09-20'),
  ('misr_insurance_istithmar_and_aman__arab_african_investment_management','Istsmar w Aman Fixed Income (EGP)','aaim:verified_identity:2026-09-20'),
  ('misr_takaful__arab_african_investment_management','Misr Takaful Sharia Compliant - Money Market','aaim:verified_identity:2026-09-20'),
  ('sarwaty__arab_african_investment_management','Sarwaty Money Market','aaim:verified_identity:2026-09-20'),

  ('mid_bank_fund_ii__beltone_asset_management','MID Bank Fund 2','beltone:verified_identity:2026-09-20'),
  ('mid_bank_fund_i__beltone_asset_management','MID Bank Fund 1','beltone:verified_identity:2026-09-20'),
  ('bank_abc_fund_mazaya__beltone_asset_management','ABC Mazaya','beltone:verified_identity:2026-09-20'),
  ('banque_du_caire_fund_ii__beltone_asset_management','Banque du Caire II El Kahera El Yawmi','beltone:verified_identity:2026-09-20'),
  ('arab_bank_fund_yomaty__beltone_asset_management','Arab Bank Yomaty','beltone:verified_identity:2026-09-20'),
  ('saib_yaumy_fund__beltone_asset_management','SAIB Money Market Fund','beltone:verified_identity:2026-09-20'),
  ('misr_insurance_fund__beltone_asset_management','Misr Insurance Fund','beltone:verified_identity:2026-09-20'),
  ('attijariwafa_bankfund__beltone_asset_management','Attijariwafa Bank Money Market Fund','beltone:verified_identity:2026-09-20'),
  ('b_youmy__beltone_asset_management','Beltone 3rd Tranche B Youmy Fund','beltone:verified_identity:2026-09-20'),
  ('adib_egypt_shari_a_compliant_al_nahrda_fund__beltone_asset_management','ADIB Islamic','beltone:verified_identity:2026-09-20'),
  ('egx30_index_etf_egx30_index_etf__beltone_asset_management','EGX 30 ETF','beltone:verified_identity:2026-09-20'),
  ('beltone_egx33_shariah_index_tracker_wafra__beltone_asset_management','Beltone EGX33 Wafra Shariah Tracker','beltone:verified_identity:2026-09-20'),
  ('beltone_egx100_index_tracker_meya_meya__beltone_asset_management','Beltone EGX100 Tracker','beltone:verified_identity:2026-09-20'),
  ('beltone_financial_fund__beltone_asset_management','Beltone Financial Fund','beltone:verified_identity:2026-09-20'),
  ('beltone_real_estate_fund__beltone_asset_management','Beltone Real Estate Fund','beltone:verified_identity:2026-09-20'),
  ('beltone_industrial_fund__beltone_asset_management','Beltone Industrial Fund','beltone:verified_identity:2026-09-20'),
  ('beltone_consumer_fund__beltone_asset_management','Beltone Consumer Fund','beltone:verified_identity:2026-09-20'),
  ('menthum_grow_egx_30_capped__beltone_asset_management','Menthum Grow Fund','beltone:verified_identity:2026-09-20'),
  ('beltone_egx_35_tracker__beltone_asset_management','EGX35 LV','beltone:verified_identity:2026-09-20'),
  ('b70_egx_70_tracker__beltone_asset_management','Beltone EGX70 Tracker','beltone:verified_identity:2026-09-20'),
  ('sabayek__beltone_asset_management','Beltone Evolve Gold Fund Sabayek','beltone:verified_identity:2026-09-20'),
  ('beltone_fada__beltone_asset_management','Beltone Evolve Silver Fund Fadda','beltone:verified_identity:2026-09-20'),
  ('b_alpha__beltone_asset_management','B Alpha','beltone:verified_identity:2026-09-20'),
  ('suez_canal_bank_fund_ii_al_agial__beltone_asset_management','Suez Canal Bank II Agial','beltone:verified_identity:2026-09-20'),
  ('qnb_al_ahli_tawazon__beltone_asset_management','QNBa Tawazon','beltone:verified_identity:2026-09-20'),
  ('sports_fund__beltone_asset_management','Egyptian Sport Fund','beltone:verified_identity:2026-09-20'),
  ('beltone_fixed_income_usd_fund__beltone_asset_management','Beltone Fixed Income USD Fund','beltone:verified_identity:2026-09-20'),
  ('b_couponat__beltone_asset_management','Beltone 2nd Tranche B Cobonat Fund','beltone:verified_identity:2026-09-20'),
  ('b_secure__beltone_asset_management','Beltone Fixed Income Fund B Secure','beltone:verified_identity:2026-09-20')
) v(fund_id,alias_name,alias_source)
where not exists (
  select 1 from public.fund_name_aliases a
  where a.fund_id=v.fund_id and a.alias_name=v.alias_name
);
