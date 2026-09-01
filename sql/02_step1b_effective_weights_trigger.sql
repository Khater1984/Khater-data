-- Step 1-b: Enforce effective_weights renormalization at DB level
-- Safe: no DROP TABLE, no DELETE. Replaces helper function + trigger only.
-- Project: jlaqotegkeszuyqzdham (Khater-data)

CREATE OR REPLACE FUNCTION public.compute_effective_weights(avail jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  keys text[] := ARRAY['performance','risk','benchmark','consistency','inflation'];
  weights numeric[] := ARRAY[0.30, 0.25, 0.25, 0.10, 0.10];
  total numeric := 0;
  i int;
  result jsonb := '{}'::jsonb;
BEGIN
  avail := COALESCE(avail, '{}'::jsonb);
  FOR i IN 1..5 LOOP
    IF COALESCE((avail ->> keys[i])::boolean, false) THEN
      total := total + weights[i];
    END IF;
  END LOOP;

  IF total <= 0 THEN
    RETURN jsonb_build_object(
      'performance', 0,
      'risk', 0,
      'benchmark', 0,
      'consistency', 0,
      'inflation', 0
    );
  END IF;

  FOR i IN 1..5 LOOP
    IF COALESCE((avail ->> keys[i])::boolean, false) THEN
      result := result || jsonb_build_object(keys[i], round(weights[i] / total, 12));
    ELSE
      result := result || jsonb_build_object(keys[i], 0);
    END IF;
  END LOOP;

  RETURN result;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.trg_set_smartscore_effective_weights()
RETURNS trigger
LANGUAGE plpgsql
AS $tg$
BEGIN
  NEW.effective_weights := public.compute_effective_weights(NEW.component_availability);

  IF NEW.calculation_inputs IS NULL OR jsonb_typeof(NEW.calculation_inputs) <> 'object' THEN
    NEW.calculation_inputs := '{}'::jsonb;
  END IF;

  NEW.calculation_inputs := NEW.calculation_inputs || jsonb_build_object(
    'weights_renormalized', true,
    'weights_basis', 'available_components_only'
  );

  RETURN NEW;
END;
$tg$;

DROP TRIGGER IF EXISTS trg_smartscore_effective_weights ON public.smartscore_evaluations;

CREATE TRIGGER trg_smartscore_effective_weights
  BEFORE INSERT OR UPDATE OF component_availability, effective_weights, calculation_inputs
  ON public.smartscore_evaluations
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_set_smartscore_effective_weights();

COMMENT ON FUNCTION public.compute_effective_weights(jsonb) IS
  'V2.0-hybrid: renormalize base weights 0.30/0.25/0.25/0.10/0.10 over available components only';

-- Annotate methodology (idempotent merge)
UPDATE public.smartscore_methodology_versions
SET rules = COALESCE(rules, '{}'::jsonb) || jsonb_build_object(
  'effective_weights_rule',
  'When a component is unavailable, its weight is redistributed proportionally across available components; stored effective_weights must match the weights used in the final smartscore sum.',
  'effective_weights_enforcement',
  'BEFORE INSERT/UPDATE trigger trg_smartscore_effective_weights on smartscore_evaluations'
)
WHERE methodology_version = 'V2.0-hybrid';
