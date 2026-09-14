# Experience V2 — Market Terminal Contract

## Objective

Move the Experience Layer from a polished card dashboard toward a dynamic financial-intelligence terminal: dense, live, evidence-first, and decision-oriented.

The reference quality bar is Bloomberg / Investing.com information hierarchy and dynamism, not visual imitation.

## Now surface

The Now surface must continuously communicate:

1. current regime;
2. latest dated market observations;
3. short-horizon movement where the data supports it;
4. what changed;
5. what the user can investigate next.

## Information hierarchy

**Live state → judgement → evidence → movement → decision route.**

Static decorative cards are not considered dynamic experience.

## Dynamic requirements

- Read canonical macro data through existing data services.
- Show freshness/date with every financial observation.
- Never invent fallback financial values.
- Make unavailable/stale data explicit.
- Keep the same data source across all surfaces.
- Preserve the financial contracts and SmartScore engine.

## Terminal patterns

- compact market strip/status;
- dense market-pulse table;
- explicit positive/negative movement;
- decision frame linking context to investigation;
- responsive desktop/mobile density;
- editorial judgement above the data wall.

## Protected architecture

Experience V2 does not alter NAV ingestion, Supabase schema, official performance semantics, benchmark definitions, SmartScore methodology, or source-of-truth rules.

## Next V2 phases

1. Now terminal — current phase.
2. Areas intelligence — dynamic category leaders, regime fit, evidence and shortlist.
3. Funds terminal — live shortlist, performance matrix, benchmark spread, confidence and warnings.
4. Fund DNA — professional entity terminal with evidence timeline.
5. Value of My Money — interactive signature comparison with selectable horizons and assets.
6. Macro — cross-benchmark context terminal with regime history.
7. Mobile density pass across all primary surfaces.
