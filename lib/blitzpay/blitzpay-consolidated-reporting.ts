import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import {
  sumActiveIntercompanyExposureCents,
  type BlitzpayIntercompanyBalanceRow,
} from "@/lib/blitzpay/blitzpay-intercompany-balances"
import { computeSharedBenchmarkCoverage0to100 } from "@/lib/blitzpay/blitzpay-shared-benchmarks"

export type BlitzpayPhase5aOrgReportingExtension = {
  multiEntityRevenueExposureCents: number
  multiEntityTreasuryExposureCents: number
  intercompanyBalanceExposureCents: number
  consolidatedCollectionsRate: number
  franchiseHealthScore: number
  sharedBenchmarkCoverage: number
  multiEntityRiskScore: number
  consolidatedOrganizationCount: number
}

export function zeroPhase5aOrgReportingExtension(): BlitzpayPhase5aOrgReportingExtension {
  return {
    multiEntityRevenueExposureCents: 0,
    multiEntityTreasuryExposureCents: 0,
    intercompanyBalanceExposureCents: 0,
    consolidatedCollectionsRate: 0,
    franchiseHealthScore: 0,
    sharedBenchmarkCoverage: 0,
    multiEntityRiskScore: 0,
    consolidatedOrganizationCount: 0,
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

function safeAdd(a: number, b: number): number {
  const s = Math.round(a) + Math.round(b)
  if (!Number.isFinite(s)) return Math.round(a)
  return s
}

/**
 * Deterministic consolidated KPI slice from linked org reporting snapshots + intercompany rows.
 * Integer math only; snapshots should already be ordered by organization id.
 */
export function mergePhase5aFromSnapshotsAndIntercompany(
  snapshotsOrdered: ReadonlyArray<BlitzpayOrgReportingSnapshot>,
  intercompanyRows: ReadonlyArray<BlitzpayIntercompanyBalanceRow>,
  distinctOrganizationCount: number,
): BlitzpayPhase5aOrgReportingExtension {
  const n = snapshotsOrdered.length
  if (!n) {
    return {
      ...zeroPhase5aOrgReportingExtension(),
      intercompanyBalanceExposureCents: sumActiveIntercompanyExposureCents(intercompanyRows),
      consolidatedOrganizationCount: Math.max(0, Math.round(distinctOrganizationCount)),
    }
  }

  let revenueExposure = 0
  let treasuryExposure = 0
  let collectionsSum = 0
  let riskSum = 0
  let franchiseSum = 0

  for (const s of snapshotsOrdered) {
    const churn = Math.max(0, Math.round(s.churnRiskRevenueCents))
    const disputes = Math.max(0, Math.round(s.openDisputesAmountCents))
    const delinq = Math.max(0, Math.round(s.delinquentMembershipRevenueCents))
    const overdue = Math.max(0, Math.round(s.estimatedRecoverableOverdueCents))
    revenueExposure = safeAdd(revenueExposure, churn)
    revenueExposure = safeAdd(revenueExposure, disputes)
    revenueExposure = safeAdd(revenueExposure, delinq)
    revenueExposure = safeAdd(revenueExposure, overdue)

    const tr = Math.max(0, Math.round(s.treasuryReserveExposureCents))
    const tp = Math.max(0, Math.round(s.treasuryPendingPayoutTotalsCents))
    const tu = Math.max(0, Math.round(s.treasuryEstimateUpcomingTransferCents))
    treasuryExposure = safeAdd(treasuryExposure, tr)
    treasuryExposure = safeAdd(treasuryExposure, tp)
    treasuryExposure = safeAdd(treasuryExposure, tu)

    collectionsSum = safeAdd(collectionsSum, Math.max(0, Math.round(s.collectionSuccessRate)))
    riskSum = safeAdd(riskSum, Math.max(0, Math.round(s.aiFinancialRiskScore)))
    const colOpt = Math.max(0, Math.round(s.collectionsOptimizationScore))
    const air = Math.max(0, Math.min(100, Math.round(s.aiFinancialRiskScore)))
    franchiseSum = safeAdd(franchiseSum, Math.round((colOpt + (100 - air)) / 2))
  }

  const ic = sumActiveIntercompanyExposureCents(intercompanyRows)
  const orgCount = Math.max(distinctOrganizationCount, n)

  return {
    multiEntityRevenueExposureCents: Math.max(0, revenueExposure),
    multiEntityTreasuryExposureCents: Math.max(0, treasuryExposure),
    intercompanyBalanceExposureCents: Math.max(0, ic),
    consolidatedCollectionsRate: clampInt(n > 0 ? collectionsSum / n : 0, 0, 100),
    franchiseHealthScore: clampInt(n > 0 ? franchiseSum / n : 0, 0, 100),
    sharedBenchmarkCoverage: computeSharedBenchmarkCoverage0to100(snapshotsOrdered),
    multiEntityRiskScore: clampInt(n > 0 ? riskSum / n : 0, 0, 100),
    consolidatedOrganizationCount: orgCount,
  }
}

/** Consolidated health score for persisted snapshots (0–100), deterministic from inputs. */
export function computeConsolidatedHealthScore0to100(
  snapshots: ReadonlyArray<BlitzpayOrgReportingSnapshot>,
  intercompanyActiveCents: number,
): number | null {
  if (!snapshots.length) return null
  const ext = mergePhase5aFromSnapshotsAndIntercompany(snapshots, [], snapshots.length)
  const icAdj = clampInt(Math.round(intercompanyActiveCents / 500_000), 0, 25)
  return clampInt(ext.franchiseHealthScore - icAdj, 0, 100)
}
