-- Remove legacy Snduk history unless the exact provider identity is verified.
delete from public.fund_price_history h
using public.funds f
where h.source_id='src_snduk'
  and coalesce(f.price_update_url,'') not ilike '%snduk.com%'
  and not exists (
    select 1
    from public.fund_name_aliases a
    where a.fund_id=h.fund_id
      and a.alias_source like 'snduk:verified_identity:%'
      and a.match_confidence >= 1.0
  );
