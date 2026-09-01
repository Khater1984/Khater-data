-- Documentation-only note for Step 1 (safe to run in SQL editor).
-- Does not drop objects. Optionally annotates methodology rules JSON.

comment on table public.smartscore_evaluations is
  'Official monthly SmartScore rows. effective_weights must reflect renormalization over available components only (null components excluded; weights re-sum to 1).';

-- Optional methodology annotation (merge-style update; keeps version id)
update public.smartscore_methodology_versions
set rules = coalesce(rules, '{}'::jsonb) || jsonb_build_object(
  'effective_weights_rule',
  'When a component is unavailable (null / component_availability=false), its weight is redistributed proportionally across available components; stored effective_weights must match the weights used in the final smartscore sum.'
)
where methodology_version = 'V2.0-hybrid';
