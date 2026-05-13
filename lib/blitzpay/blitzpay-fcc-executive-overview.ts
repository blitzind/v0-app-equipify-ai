import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { fetchBlitzpayBusinessHealth } from "@/lib/blitzpay/blitzpay-business-health"
import type { BlitzpayBusinessHealthPayload } from "@/lib/blitzpay/blitzpay-business-health-types"
import {
  buildMultiEntityHealthPayload,
  listMultiEntityAuditForOrganizationContext,
  listVisibleFinancialGroupsForOrganization,
} from "@/lib/blitzpay/blitzpay-multi-entity-finance"
import type {
  FccExecutiveHealthCard,
  FccExecutiveHealthTone,
  FccExecutiveOverviewPayload,
  FccExecutiveTimelineItem,
} from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import type { FccExecutiveOverviewDataScope } from "@/lib/blitzpay/executive-overview-widgets"
import { BLITZPAY_FCC_FUNDS_DISCLAIMER } from "@/lib/blitzpay/blitzpay-fcc-executive-overview-types"
import { buildExecutiveAttentionPack } from "@/lib/blitzpay/blitzpay-executive-attention-engine"

function clampScore(n: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return 0
  return Math.min(100, Math.max(0, x))
}

function toneForHigherIsBetter(score: number): FccExecutiveHealthTone {
  if (score >= 72) return "healthy"
  if (score >= 52) return "watch"
  return "risk"
}

/** Concentration risk: higher score = worse. */
function toneForRiskScore(score: number): FccExecutiveHealthTone {
  if (score <= 38) return "healthy"
  if (score <= 58) return "watch"
  return "risk"
}

function buildHealthCards(health: BlitzpayBusinessHealthPayload, facts: BlitzpayBusinessHealthPayload["facts"]): FccExecutiveHealthCard[] {
  const s = health.scores
  const fmtPayroll =
    facts.payrollLiabilityCents > 0
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(
          facts.payrollLiabilityCents / 100,
        ) + " accrued liability (internal estimate)."
      : "No material payroll accrual surfaced in this window."

  const cards: FccExecutiveHealthCard[] = [
    {
      id: "overall",
      label: "Overall business health",
      score: s.overall,
      subtitle: "Blended view of cash, collections, operations, and risk signals.",
      tone: toneForHigherIsBetter(s.overall),
      hrefKind: "fcc",
      fccSlug: "executive-health",
    },
    {
      id: "financial",
      label: "Financial health",
      score: s.financial,
      subtitle: "Receivables pressure, disputes, and net cash outlook blend.",
      tone: toneForHigherIsBetter(s.financial),
      hrefKind: "fcc",
      fccSlug: "command-center-data",
    },
    {
      id: "collections",
      label: "Collections health",
      score: s.collections,
      subtitle: "Overdue pressure vs. reminder performance in the reporting window.",
      tone: toneForHigherIsBetter(s.collections),
      hrefKind: "fcc",
      fccSlug: "collections",
    },
    {
      id: "operations",
      label: "Operational efficiency",
      score: s.operationalEfficiency,
      subtitle: "Work completed vs. invoiced, field billing discipline, and leakage notes.",
      tone: toneForHigherIsBetter(s.operationalEfficiency),
      hrefKind: "fcc",
      fccSlug: "internal-books",
    },
    {
      id: "cash_momentum",
      label: "Cash momentum",
      score: s.cashFlowPressure,
      subtitle: "Higher scores reflect healthier cash pressure balance in this model.",
      tone: toneForHigherIsBetter(s.cashFlowPressure),
      hrefKind: "fcc",
      fccSlug: "operating-cash",
    },
    {
      id: "service_confidence",
      label: "Service profitability confidence",
      score: s.serviceProfitabilityConfidence,
      subtitle: "Refund and dispute drag vs. collected revenue in the window.",
      tone: toneForHigherIsBetter(s.serviceProfitabilityConfidence),
      hrefKind: "fcc",
      fccSlug: "revenue-optimization",
    },
    {
      id: "concentration",
      label: "Customer concentration risk",
      score: s.customerConcentrationRisk,
      subtitle: "Higher means overdue balances are more concentrated — diversify where practical.",
      tone: toneForRiskScore(s.customerConcentrationRisk),
      hrefKind: "fcc",
      fccSlug: "billing-profiles",
    },
    {
      id: "payroll_pressure",
      label: "Payroll & commissions",
      score: null,
      subtitle: fmtPayroll,
      tone:
        facts.payrollLiabilityCents > 250_000_00
          ? "watch"
          : facts.payrollPendingCommissionCents > 500_000
            ? "watch"
            : "healthy",
      hrefKind: "fcc",
      fccSlug: "payroll-commissions",
    },
  ]
  return cards
}

async function fetchStripeBrief(
  admin: SupabaseClient,
  organizationId: string,
): Promise<FccExecutiveOverviewPayload["stripe"] & { connectAccountPresent: boolean }> {
  const { data, error } = await admin
    .from("organizations")
    .select(
      "stripe_connect_account_id, stripe_charges_enabled, stripe_payouts_enabled, stripe_connect_onboarding_complete, stripe_details_submitted, stripe_connect_status",
    )
    .eq("id", organizationId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  const row = data as {
    stripe_connect_account_id?: string | null
    stripe_charges_enabled?: boolean | null
    stripe_payouts_enabled?: boolean | null
    stripe_connect_onboarding_complete?: boolean | null
    stripe_details_submitted?: boolean | null
    stripe_connect_status?: string | null
  } | null
  const connectAccountPresent = Boolean(row?.stripe_connect_account_id)
  return {
    connectAccountPresent,
    chargesEnabled: row?.stripe_charges_enabled === true,
    payoutsEnabled: row?.stripe_payouts_enabled === true,
    onboardingComplete: row?.stripe_connect_onboarding_complete === true,
    detailsSubmitted: row?.stripe_details_submitted === true,
    connectStatus: row?.stripe_connect_status ?? null,
  }
}

async function fetchPendingApCount(admin: SupabaseClient, organizationId: string): Promise<number> {
  const { count, error } = await admin
    .from("blitzpay_vendor_payables")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "pending_approval")
  if (error) throw new Error(error.message)
  return count ?? 0
}

async function fetchComplianceTimeline(admin: SupabaseClient, organizationId: string, limit: number): Promise<FccExecutiveTimelineItem[]> {
  const lim = Math.min(12, Math.max(1, Math.round(limit)))
  const { data, error } = await admin
    .from("blitzpay_compliance_audit_log")
    .select("audit_type, audit_summary, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    occurredAt: String((row as { created_at: string }).created_at),
    label: String((row as { audit_summary?: string }).audit_summary ?? (row as { audit_type?: string }).audit_type ?? "Compliance event"),
    category: "compliance" as const,
  }))
}

export async function fetchBlitzpayFccExecutiveOverview(
  admin: SupabaseClient,
  organizationId: string,
  options?: { reportingWindowDays?: number; dataScope?: FccExecutiveOverviewDataScope },
): Promise<FccExecutiveOverviewPayload> {
  assertUuid(organizationId, "organizationId")
  const reportingWindowDays = Math.min(90, Math.max(7, Math.round(Number(options?.reportingWindowDays ?? 30))))
  const sinceIso = new Date(Date.now() - reportingWindowDays * 86400_000).toISOString()
  const scope = options?.dataScope ?? "scale_full"

  const healthP = fetchBlitzpayBusinessHealth(admin, organizationId, { reportingWindowDays })
  const stripeP = fetchStripeBrief(admin, organizationId)

  const needAp = scope === "growth_standard" || scope === "scale_full"
  const needCompliance = scope === "core_standard" || scope === "growth_standard" || scope === "scale_full"
  const needMultiEntity = scope === "scale_full"

  const pendingApP = needAp ? fetchPendingApCount(admin, organizationId) : Promise.resolve(0)
  const complianceP = needCompliance ? fetchComplianceTimeline(admin, organizationId, 10) : Promise.resolve([] as FccExecutiveTimelineItem[])

  const [health, stripe, pendingApCount, complianceTimeline] = await Promise.all([
    healthP,
    stripeP,
    pendingApP,
    complianceP,
  ])

  const groups = needMultiEntity
    ? await listVisibleFinancialGroupsForOrganization(admin, organizationId)
    : []

  const { connectAccountPresent: _cap, ...stripePublic } = stripe

  let multiEntity: FccExecutiveOverviewPayload["multiEntity"] = null
  let enterpriseTimeline: FccExecutiveTimelineItem[] = []
  if (needMultiEntity && groups.length >= 2) {
    const meh = await buildMultiEntityHealthPayload(admin, organizationId, sinceIso)
    const p5 = meh.phase5a
    multiEntity = {
      visibleGroupCount: meh.visibleGroupCount,
      activeMemberOrgApprox: meh.activeMemberOrgApprox,
      franchiseHealthScore: clampScore(p5.franchiseHealthScore),
      multiEntityRiskScore: clampScore(p5.multiEntityRiskScore),
      consolidatedCollectionsRate: clampScore(p5.consolidatedCollectionsRate),
      intercompanyBalanceExposureCents: Math.max(0, Math.round(p5.intercompanyBalanceExposureCents)),
      multiEntityTreasuryExposureCents: Math.max(0, Math.round(p5.multiEntityTreasuryExposureCents)),
    }
    const meRows = await listMultiEntityAuditForOrganizationContext(admin, organizationId, 6)
    enterpriseTimeline = meRows.map((row) => ({
      occurredAt: String((row as { created_at: string }).created_at),
      label: String((row as { audit_summary?: string }).audit_summary ?? "Enterprise activity"),
      category: "enterprise" as const,
    }))
  }

  const timelineMerged = [...enterpriseTimeline, ...complianceTimeline]
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 12)

  const attentionPack = buildExecutiveAttentionPack({
    health,
    dataScope: scope,
    pendingApCount,
    stripe: {
      connectAccountPresent: stripe.connectAccountPresent,
      onboardingComplete: stripe.onboardingComplete,
      chargesEnabled: stripe.chargesEnabled,
    },
  })

  const f = health.facts

  return {
    disclaimer: BLITZPAY_FCC_FUNDS_DISCLAIMER,
    reportingWindowDays: health.reportingWindowDays,
    generatedAt: health.generatedAt,
    healthCards: buildHealthCards(health, f),
    attention: attentionPack.alerts,
    attentionEngineVersion: attentionPack.version,
    cash: {
      runwayStatus: f.cashRunwayStatus,
      operatingCashCents: f.estimatedOperatingCashCents,
      expectedInflows7dCents: f.expectedInflows7dCents,
      expectedInflows30dCents: f.expectedInflows30dCents,
      expectedOutflows7dCents: f.expectedOutflows7dCents,
      expectedOutflows30dCents: f.expectedOutflows30dCents,
      overdueCollectibleCents: f.overdueCollectibleCents,
      overdueInvoiceCount: f.overdueInvoiceCount,
      reserveGapCents: f.cashReserveGapCents,
      reserveTargetCents: f.cashReserveTargetCents,
    },
    revenue: {
      recurringPlannedInflow30dCents: f.recurringPlannedInflow30dCents,
      recurringStabilityScore0to100: f.recurringStabilityScore0to100,
      autopayAdoptionPct: f.autopayAdoptionPct,
      renewalSuccessProxyPct: f.renewalSuccessProxyPct,
      churnRiskScore0to100: f.churnRiskScore0to100,
      projectedRenewalRevenue90dCents: f.projectedRenewalRevenue90dCents,
    },
    collections: {
      reminderEffectivenessRatePct: f.reminderEffectivenessRatePct,
      reminderConversionRatePct: f.reminderConversionRatePct,
      fieldCollectionRecoveryRatePct: f.fieldCollectionRecoveryRatePct,
      estimatedRecoverableOverdueCents: f.estimatedRecoverableOverdueCents,
      workOrdersWithCollectibleBalancesCount: f.workOrdersWithCollectibleBalancesCount,
    },
    operationalNotes: health.pipeline.operationalLeakageNotes.slice(0, 8),
    cashAccelerationNotes: health.pipeline.cashAccelerationOpportunities.slice(0, 6),
    executiveBriefing: {
      paragraph: attentionPack.executiveBriefing.paragraph,
      opportunities: attentionPack.executiveBriefing.opportunities.slice(0, 3),
      risks: attentionPack.executiveBriefing.risks.slice(0, 3),
      suggestedActions: attentionPack.executiveBriefing.suggestedActions.slice(0, 3),
    },
    multiEntity,
    timeline: timelineMerged,
    stripe: stripePublic,
  }
}
