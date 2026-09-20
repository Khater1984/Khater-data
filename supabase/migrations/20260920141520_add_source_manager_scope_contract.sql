alter table public.sources
  add column if not exists management_company_scope text;

update public.sources
set management_company_scope = case source_id
  when 'src_efg_hermes_funds' then 'Hermes Portfolio and Fund Management'
  when 'src_cicapital_fundprice' then 'CI Asset Management'
  when 'src_prime_am' then 'Prime Investments'
  when 'src_nicapital_am' then 'NI Capital'
  when 'src_hc_si' then 'HC Securities & Investment'
  when 'src_pfi_funds' then 'PFI Asset Management'
  when 'src_afim_investment' then 'Al Ahly Financial Investments Management'
  when 'src_aaim_funds' then 'Arab African Investment Management'
  when 'src_beltone_funds' then 'Beltone Asset Management'
  when 'src_azimut_funds' then 'Azimut Egypt Asset Management'
  when 'src_granite_eg' then 'Granite Fund Management'
  when 'src_zaldi_capital' then management_company_scope
  else management_company_scope
end
where source_id in (
  'src_efg_hermes_funds','src_cicapital_fundprice','src_prime_am',
  'src_nicapital_am','src_hc_si','src_pfi_funds','src_afim_investment',
  'src_aaim_funds','src_beltone_funds','src_azimut_funds','src_granite_eg',
  'src_zaldi_capital'
);
