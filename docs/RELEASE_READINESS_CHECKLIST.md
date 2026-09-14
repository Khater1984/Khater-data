# Release Readiness Checklist

This is the final human-validation layer after automated Quality Gates. It does not change runtime financial logic.

## 1. Product journey

Validate the complete journey on desktop and mobile:

`Home → Macro → Categories → Opportunity Radar → Funds → Fund Detail → Decision`

For every transition confirm:
- the destination is obvious;
- the context selected by the user is preserved;
- no unexplained jump occurs;
- the user can return without losing state.

## 2. Evidence discipline

For every material insight:
- identify the underlying benchmark/data point;
- distinguish observed data from interpretation;
- expose the relevant date/period;
- make missing or stale data visible;
- avoid presenting discovery signals as investment advice.

## 3. Macro context

Confirm the user can understand:
- inflation;
- EGP/USD;
- rates / T-bills;
- major market benchmarks;
- how the current regime affects the interpretation of fund returns.

## 4. Opportunity surfaces

Confirm Radar and Categories:
- explain why an item appears;
- show the relevant comparison/context;
- distinguish opportunity from warning;
- do not imply certainty or guaranteed future performance.

## 5. Fund Detail

Confirm a user can answer:
1. What happened?
2. Compared with what?
3. Why might the difference exist?
4. How reliable is the evidence?
5. What should I investigate next?

## 6. Data quality states

Test at least:
- complete data;
- missing NAV;
- stale NAV;
- missing benchmark;
- insufficient history;
- unavailable document/source;
- loading;
- empty result;
- error.

The UI must explain the limitation rather than silently inventing or implying a value.

## 7. Mobile validation

Check 360px/390px-class widths:
- header/navigation;
- KPI cards;
- charts;
- heatmap;
- filters;
- tables;
- fund tabs;
- long fund names;
- Arabic/English mixed content;
- horizontal overflow.

## 8. Accessibility

Keyboard-test:
- navigation;
- tabs;
- filters;
- search;
- modal/dialog surfaces;
- chart-adjacent controls.

Verify visible focus, logical tab order, meaningful labels, and live status announcements.

## 9. Final invariants

Do not modify during final UI validation:
- NAV ingestion;
- SmartScore methodology;
- benchmark calculations;
- canonical `web/js/data` boundary;
- Supabase financial source of truth.

## Release decision

**Release Candidate** only when automated Quality Gates are green AND the complete checklist has been manually validated on desktop and mobile.
