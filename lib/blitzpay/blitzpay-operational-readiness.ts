import "server-only"

import { BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION } from "@/lib/billing/blitzpay-entitlements"
import { BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH } from "@/lib/blitzpay/blitzpay-reporting-snapshot-nesting"

export type BlitzpayOperationalReadinessStrip = {
  generatedAt: string
  entitlementFoundationVersion: string
  /** Root org reporting loads stay nominal; depth cap applies to nested snapshot graphs. */
  reportingSnapshotRecursionGuard: "nominal" | "depth_capped"
  reportingNestingDepthMax: number
  mobileFieldReadinessScore0to100: number
  observabilityReplayGovernanceLabel: string
  permissionAuditNote: string
  overallComfort0to100: number
  checklistLines: readonly string[]
}

export function computeBlitzpayOperationalReadinessStrip(input: {
  /** When true, nested reporting was forced to skip expensive enrichers (defensive; rare at org root). */
  reportingForcedSkips?: boolean
  trialBalanceHealthy: boolean
  stripePayoutsEnabled: boolean
  mobileSyncFailureRate: number
  mobileTreasuryVisibilityScore: number
  mobileSignatureCoverageRate: number
  observabilityCoverageRate: number
  queueHealthScore: number
  workflowFailureRate: number
  replayIntegrityScore: number
}): BlitzpayOperationalReadinessStrip {
  const mobileFieldReadinessScore0to100 = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        55 +
          (input.mobileTreasuryVisibilityScore ?? 0) * 0.22 +
          (input.mobileSignatureCoverageRate ?? 0) * 0.25 -
          Math.min(25, (input.mobileSyncFailureRate ?? 0) * 120),
      ),
    ),
  )

  let overall = 70
  if (input.trialBalanceHealthy) overall += 6
  else overall -= 8
  if (input.stripePayoutsEnabled) overall += 5
  else overall -= 4
  overall += Math.round((input.observabilityCoverageRate ?? 0) * 0.1)
  overall += Math.round((input.queueHealthScore ?? 100) * 0.08)
  overall -= Math.round(Math.min(15, (input.workflowFailureRate ?? 0) * 200))
  overall += Math.round((input.replayIntegrityScore ?? 0) * 0.05)
  overall = Math.max(0, Math.min(100, overall))

  const checklistLines = [
    `Reporting snapshot nesting is capped at depth ${String(BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH)}; beyond the cap, Phase 5A/5B/5C/6A/6B enrichers are skipped automatically.`,
    "Phase 5A linked-org pulls always set skip flags on member snapshots to prevent recursion loops.",
    "Observability workflow replay is limited to organization owners, admins, or platform operators (visibility-first).",
    "BlitzPay org APIs should keep `requireAnyOrgPermission` / `requireOrgPermission` aligned with new routes as they ship.",
  ] as const

  return {
    generatedAt: new Date().toISOString(),
    entitlementFoundationVersion: BLITZPAY_ENTITLEMENTS_FOUNDATION_VERSION,
    reportingSnapshotRecursionGuard: input.reportingForcedSkips ? "depth_capped" : "nominal",
    reportingNestingDepthMax: BLITZPAY_REPORTING_SNAPSHOT_MAX_NESTING_DEPTH,
    mobileFieldReadinessScore0to100,
    observabilityReplayGovernanceLabel: "Owners, admins, platform operators",
    permissionAuditNote:
      "Phase 7A audit: confirm each new BlitzPay Route Handler uses org UUID validation, schema guard where applicable, and finance-capability gates before service-role reads.",
    overallComfort0to100: overall,
    checklistLines,
  }
}
