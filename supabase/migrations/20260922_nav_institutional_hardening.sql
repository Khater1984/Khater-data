-- NAV institutional hardening: explicit frequency + provenance contract
ALTER TABLE public.nav_staging
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS frequency_provenance text,
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_version text NOT NULL DEFAULT 'nav-contract-v2';

ALTER TABLE public.nav_official
  ADD COLUMN IF NOT EXISTS frequency text,
  ADD COLUMN IF NOT EXISTS frequency_provenance text,
  ADD COLUMN IF NOT EXISTS provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS contract_version text NOT NULL DEFAULT 'nav-contract-v2';

CREATE INDEX IF NOT EXISTS idx_nav_staging_fund_date_verification
  ON public.nav_staging (fund_id, as_of_date DESC, verification_status);

CREATE INDEX IF NOT EXISTS idx_nav_staging_contract_version
  ON public.nav_staging (contract_version);

CREATE INDEX IF NOT EXISTS idx_nav_official_contract_version
  ON public.nav_official (contract_version);

UPDATE public.nav_official o
SET
  frequency = COALESCE(o.frequency, s.frequency),
  frequency_provenance = COALESCE(o.frequency_provenance, s.frequency_provenance),
  provenance = CASE
    WHEN o.provenance <> '{}'::jsonb THEN o.provenance
    ELSE jsonb_build_object(
      'contract_version','nav-contract-v2',
      'backfill',true,
      'run_id',s.run_id,
      'staging_id',s.id,
      'source_id',o.source_id,
      'source_url',o.source_url,
      'as_of_date',o.as_of_date,
      'date_provenance',COALESCE(s.raw->>'date_provenance','unknown'),
      'identity_provenance',COALESCE(s.raw->>'identity_match','unknown')
    )
  END,
  contract_version = 'nav-contract-v2'
FROM public.nav_staging s
WHERE o.staging_id = s.id;
