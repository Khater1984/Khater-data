# NAV Phase 2 Policy

- Source-published future NAV dates are accepted only when they are no more than 7 calendar days ahead of the pipeline date.
- Undated NAV values are never promoted.
- Existing newer official NAV values are never overwritten by older candidates.
- When the manager source has no usable current NAV/date, the ingest may fall back to SNDUK (`src_snduk`).
- SNDUK fallback rows are explicitly marked as third-party provenance in staging and remain identified by `source_id=src_snduk` in official data.
- The database history trigger uses the same 7-day future-date boundary so a valid weekly source-published date is not rejected while fabricated/implausible dates remain blocked.
- Zaldi parser aliases are normalized to the canonical `src_zaldi_capital` source id before staging.
