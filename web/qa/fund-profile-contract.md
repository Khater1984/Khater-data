# Fund Profile QA Contract

This file documents the read-only QA contract for FUND DNA.

- `funds` is the source for identity, management company, category and metadata.
- `fund_smartscore_latest` is the source for the latest SmartScore summary and component scores.
- `fund_performance_history` is the source for performance records shown in the Performance tab.
- `smartscore_evaluations` (V3.0) is the source for saved evidence fields.
- `macro_series` is the source for benchmark series used by the Benchmark tab.
- The UI must not invent missing values or dates.
- The UI may calculate transparent comparison outputs only when the calculation is explicitly defined by the platform methodology; calculated outputs must be labeled accordingly.
- A missing source value remains unavailable in the UI.
