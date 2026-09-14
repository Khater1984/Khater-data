# Release Candidate Gate

The frontend is considered Release Candidate only when the existing domain contracts and the whole-product audit pass together.

## Product journey

`Home → Macro → Categories → Opportunity Radar → Funds → Fund Detail → Decision`

## Architectural invariants

- Supabase remains the authoritative live financial source.
- Browser pages consume the canonical `web/js/data` layer.
- NAV ingestion and SmartScore methodology are unchanged by frontend hardening.
- Repository JSON snapshots are not runtime financial sources of truth.
- Shared `header.css` remains the product shell.

## Whole-product checks

- Top-level pages have explicit language and direction.
- One main landmark per page.
- Shared navigation is present.
- Local script/stylesheet references resolve.
- No inline JavaScript or inline event-handler attributes.
- No inline CSS remains on production pages.
- No duplicate HTML IDs.
- No `javascript:` navigation.
- No direct Supabase REST access outside `web/js/data`.
- Browser config contains no service-role credential marker.
- Canonical data and architecture anchors exist.
- Existing financial, page, CSS, boundary and build contracts remain green.

## Release rule

A green Quality Gate is necessary but not sufficient for release. The final release decision also requires manual product validation of the full journey on mobile and desktop, with special attention to evidence, warnings, missing-data states, and the distinction between opportunity discovery and investment advice.
