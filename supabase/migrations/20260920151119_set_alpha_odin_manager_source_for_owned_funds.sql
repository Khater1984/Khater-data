-- Set Alpha/Odin as the preferred manager source for its three active funds.
update public.funds
set source_id='src_alpha_odin'
where fund_id in (
  'delta_life_insurance__x',
  'odin_4__x',
  'odin_trend__x'
);
