-- Step 2: benchmark_return from macro_series
-- Safe: CREATE OR REPLACE FUNCTION only. No deletes.
-- For price/index level series (egx30, gold_egp_oz, usd_egp_mid, spy_egp, ...).
-- Yield-style series (tbill % levels) need a different interpretation later in Step 3.

CREATE OR REPLACE FUNCTION public.benchmark_return(
  p_series_key text,
  p_start_date date,
  p_end_date date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS '
DECLARE
  v_start numeric;
  v_end numeric;
  d0 date;
  d1 date;
BEGIN
  IF p_series_key IS NULL OR btrim(p_series_key) = '''' THEN
    RETURN NULL;
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RETURN NULL;
  END IF;

  d0 := p_start_date;
  d1 := p_end_date;
  IF d0 > d1 THEN
    d0 := p_end_date;
    d1 := p_start_date;
  END IF;

  SELECT m.value INTO v_start
  FROM public.macro_series m
  WHERE m.series_key = p_series_key
    AND m.ts_date <= d0
    AND m.value IS NOT NULL
  ORDER BY m.ts_date DESC
  LIMIT 1;

  SELECT m.value INTO v_end
  FROM public.macro_series m
  WHERE m.series_key = p_series_key
    AND m.ts_date <= d1
    AND m.value IS NOT NULL
  ORDER BY m.ts_date DESC
  LIMIT 1;

  IF v_start IS NULL OR v_end IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_start = 0 THEN
    RETURN NULL;
  END IF;

  RETURN (v_end / v_start) - 1;
END;
';

COMMENT ON FUNCTION public.benchmark_return(text, date, date) IS
  'Trailing return from macro_series levels: value(end)/value(start)-1. Null if missing. Prefer *_egp* keys for EGP fund comparisons.';

GRANT EXECUTE ON FUNCTION public.benchmark_return(text, date, date) TO anon, authenticated, service_role;
