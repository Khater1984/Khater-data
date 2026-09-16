# Khater Experience Architecture V1

Status: live product shell on `main` after retiring the Areas/Heatmap surface for a clean rebuild.

## Product rule

The frontend is an investment-intelligence experience, not a collection of equal pages. The user may enter with different intents, so navigation must not behave like a wizard.

## Primary navigation

1. **الآن** — live/current market brief and hub.
2. **قيمة ثروتي** — signature outcome experience.
3. **الاقتصاد** — macro context / Why layer.
4. **الصناديق** — searchable investment universe / investigation layer.

Secondary surfaces:

- **Fund DNA** — entity-level investigation, not a primary tab.
- **المنهج** — methodology, audit and transparency reference, not a primary tab.

Deferred:

- **المناطق** — retired from the live shell. It will be rebuilt from scratch under the unified Nile identity. No heatmap compatibility route remains.

## Home contract

The Home / Now surface must answer before it routes:

> ماذا يحدث الآن؟

Above the fold:

- one regime judgement;
- one explanatory sentence;
- 3–4 dated market signals;
- intent branches: Value of My Money, Economy, Funds;
- a clear route into Funds without presenting it as the default answer.

Home is a hub, not a portal full of links.

## Visual hierarchy contract

Every analytical surface follows:

**Question → Judgement → Number → Evidence → Detail → Next action**

Decorative UI never outranks evidence. A number without date/context is incomplete. Missing/stale data must be explicit rather than replaced with invented fallback values.

## Signature contract

Value of My Money is the emotional/product signature. It must explain the outcome before asking the user to inspect the chart. The existing calculation/data implementation remains authoritative; the redesign changes presentation and hierarchy, not the financial methodology.

## Protected core

Experience work must not change:

- Supabase schema;
- NAV ingestion;
- official EIMA performance semantics;
- SmartScore methodology or stored score meaning;
- benchmark definitions;
- canonical data services;
- current financial source-of-truth rules.

## Quality definition

A green Quality Gate is necessary but not sufficient. Experience V1 is complete only when the browser journey is coherent on desktop and 360–390px mobile, states are explicit, navigation is consistent, and the primary surfaces communicate their question and judgement within the first screen.
