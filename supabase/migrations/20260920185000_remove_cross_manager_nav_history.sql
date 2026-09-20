-- Remove only NAV history rows proven to be cross-manager contamination.
with expected as (
  select * from (values
    ('src_efg_hermes_funds','Hermes Portfolio and Fund Management'),
    ('src_cicapital_fundprice','CI Asset Management'),
    ('src_prime_am','Prime Investments'),
    ('src_nicapital_am','NI Capital'),
    ('src_hc_si','HC Securities & Investment'),
    ('src_pfi_funds','PFI Asset Management'),
    ('src_afim_investment','Al Ahly Financial Investments Management'),
    ('src_aaim_funds','Arab African Investment Management'),
    ('src_beltone_funds','Beltone Asset Management'),
    ('src_azimut_funds','Azimut Egypt Asset Management'),
    ('src_granite_eg','Granite Fund Management')
  ) v(source_id,expected)
)
delete from public.fund_price_history h
using public.funds f, expected e
where h.fund_id=f.fund_id
  and h.source_id=e.source_id
  and f.management_company is distinct from e.expected;
