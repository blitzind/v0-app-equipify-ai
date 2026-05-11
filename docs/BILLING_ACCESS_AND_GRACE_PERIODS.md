# Billing access, grace messaging & lockout posture (Phase 60.4)

This document describes **how Equipify interprets Stripe / `organization_subscriptions` for UX and soft enforcement**, without implementing **hard account lockout** (full read denial). It complements:

- `docs/PLAN_ENTITLEMENT_ENFORCEMENT_AUDIT.md` — entitlements vs permissions  
- `docs/USAGE_METERING_ENFORCEMENT.md` — seats, equipment, API counters  

## State table (authoritative logic: `lib/billing/access.ts`)

| Situation | `getBillingAccessState().level` | `allowRecordCreation` | App strip (`BillingWarningBanner`) | Notes |
|-----------|----------------------------------|------------------------|-------------------------------------|--------|
| **No subscription row** | `full` | **true** | **No** (by design) | Onboarding / demo / legacy; product choice — not a hard problem in UX strip. Billing **page** shows an informational “Billing setup” card (`MISSING_SUBSCRIPTION_BILLING_NOTE`). |
| **Trialing** (active trial window) | `full` | **true** | **Yes** when ≤ **7** days left (`TRIAL_ENDING_WARNING_DAYS`) | Normal access; honest “review billing to avoid interruption” copy. |
| **Trial expired** (`status` still `trialing` but window ended) | `restricted` | **false** | **Yes** | Record creation blocked via `evaluateStandardCreate` / gates; copy avoids “locked” / “disabled”. |
| **Active** | `full` | **true** | **No** | |
| **Active + `cancel_at_period_end`** | `warning` | **true** | **Yes** | User keeps working until period end; messaging explains cancel-at-period-end. |
| **Past due** | `warning` | **true** | **Yes** | Payment CTA; creation still allowed today (grace — not hard lockout). |
| **Incomplete** | `warning` | **true** | **Yes** | Finish checkout CTA. |
| **Unpaid / Canceled / Incomplete expired / Paused** | `restricted` | **false** | **Yes** | Creating **new** operational records is blocked where `requireCanCreateRecord` runs; **read** access is not stripped in this phase. |

## User-facing copy policy (60.4)

- Prefer **“Payment needs attention”**, **“Update billing to avoid interruption”**, **“Subscription canceled”** (factual), **“Billing setup”** / **“Billing setup needed”**.  
- Avoid **“locked”**, **“disabled”**, **“will be deleted”** unless the product truly implements that behavior.  
- Restricted states: say **“continue creating new records”** where creation is what’s gated — not “restore access” unless read access is actually removed.

Helpers:

- `getBillingWarningMessage` — primary strip text  
- `getBillingAppBannerTone` — `info` / `warning` / `critical` styling for the strip  
- `MISSING_SUBSCRIPTION_BILLING_NOTE` — no-row billing page card  

## Where UX appears

| Surface | Behavior |
|---------|----------|
| **Dashboard shell** | `components/billing-warning-banner.tsx` — hidden on `/settings/billing`; dismissible per session (client state). |
| **Billing settings** | `app/(dashboard)/settings/billing/page.tsx` — payment-attention card, past_due row, trial cards, **no-subscription** info card. |
| **Enforcement** | `getBillingAccessState` → `record-eligibility` / `server-guard` — **record creation** only when `allowRecordCreation` is false. |

## Platform admin & demo

- **Platform admins** are **not** given a separate billing-banner bypass in Phase 60.4: the strip is informational and does not block navigation. They see the same messaging when working inside a customer org (useful for support).  
- **Demo / sample orgs** often have **no subscription row** — they keep **full** access per table above; no new app-wide nag was added for missing rows.  

## Future: hard lockout (not in 60.4)

If product later requires **read-only mode** or **route-level deny** for restricted billing:

- Centralize on `getBillingAccessState` + middleware or layout checks.  
- Keep Stripe webhooks and `organization_subscriptions` as source of truth.  
- Add explicit QA for **platform admin** break-glass and **demo** org flags.  

## Manual QA

- [ ] Active paid org: no top strip (unless cancel-at-period-end).  
- [ ] Trial ≤ 7 days: strip + honest copy.  
- [ ] Past due: strip + billing page alignment.  
- [ ] Canceled / unpaid: strip + create blocked on guarded flows, copy does not claim data deletion.  
- [ ] No subscription row: no top strip; billing page shows setup card when appropriate.  
- [ ] Billing page payment card matches app messaging tone.  

## References

- `lib/billing/access.ts`  
- `lib/billing/subscriptions.ts` — `getEffectiveBillingStatus`, trial helpers  
- `components/billing-warning-banner.tsx`  
- `app/(dashboard)/settings/billing/page.tsx`  
