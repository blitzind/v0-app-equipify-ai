# AVA-GROWTH-HOTFIX-1F-1D — Restore Canonical Training State and Activation

## Root cause

Read-model regression after 1F Home consolidation — not missing production training data.

1. **Training page all-or-nothing client fetches** — `useGrowthTrainingOverviewData` used `Promise.all` without per-source isolation. Any single API failure left profile, runbook, and launch setup empty even when approved records existed server-side.
2. **Home activation null on budget timeout** — `ava_activation` loader (6s budget) returned `fallback: null` when `loadGrowthAvaActivationState` exceeded budget (employment stats fan-in). Null activation forced `autonomyEnabled=false` presentation paths and Idle / “not activated” copy.
3. **`setupIncomplete` narrative heuristic** — Home used `dailyActivityNarrative.focus === "setup"` instead of canonical activation readiness, so completed training could still show “Continue setup”.
4. **Previously activated + kill switches off** — `buildStartStatus` treated paused autonomy as “I'm ready but not activated yet” instead of preserved activation with paused runtime.

## Production training records

No migration or copy performed. Canonical projection reads existing authorities:

- `growth.organization_business_profiles` (`status = approved`)
- `@fuzor/identity` organization persona activation (`autonomousActivatedAt`)
- Mission / mailbox / autonomy setup via existing launch synthesizer
- Organizational knowledge store (validated learnings filter unchanged)

## Classification

**Read-model regression** with secondary **activation presentation regression**. Not a tenant mismatch (all paths use `getGrowthEngineAiOrgId()`).

## Fix

Single server read authority:

- `loadGrowthCanonicalOrganizationTrainingProjection()` in `lib/growth/training/growth-canonical-organization-training-projection-1d-hotfix.ts`
- Included on Home workspace summary as `canonicalOrganizationTraining`
- Training page consumes projection first; client APIs refresh in background with isolated fetch errors
- Activation core path reuses projection; timeout fallback builds activation from projection + runtime kill switches
- `setupIncomplete` uses `canonicalOrganizationTraining.setupIncomplete` (activation readiness blockers)

## Diagnostics (read-only, not operator UI)

`canonicalOrganizationTraining.diagnostic` on workspace summary payload:

- organization ID
- company profile / strategy / runbook state
- validated learning count
- activation readiness + blocking reasons
- source record IDs used by projection

## Validation

```bash
pnpm build
pnpm test:ava-growth-operator-1f-platform-consolidation
pnpm test:ava-growth-hotfix-1f-1b-home-summary-resilience
pnpm test:ava-growth-hotfix-1f-1d-canonical-training-state
```

## Production validation

1. Open Home → confirm Training areas reflect approved profile when records exist.
2. Confirm Home setup CTA only when `diagnostic.setupIncomplete === true`.
3. If Ava was previously activated and kill switches are off → “Autonomous mode is paused” (not “not activated”).
4. Outbound remains gated by existing approval policies (unchanged).
