import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { detectBlitzpayFinancialAnomalies } from "@/lib/blitzpay/blitzpay-ai-anomaly-detection"
import { buildBlitzpayAiForecastSnapshots } from "@/lib/blitzpay/blitzpay-ai-forecasting"
import {
  buildAdvisoryReasoningLine,
  buildExecutiveFinancialSummaryLines,
  defaultActionTypeForInsight,
  sortInsightsDeterministic,
  type BlitzpayAiInsightType,
  type BlitzpayAiPrioritizedInsight,
} from "@/lib/blitzpay/blitzpay-ai-recommendations"
import { computeBlitzpayPhase4aReportingScores } from "@/lib/blitzpay/blitzpay-ai-snapshot-scores"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"

export const BLITZPAY_AI_FIN_COPILOT_LIST_CAP = 50
export const BLITZPAY_AI_FORECAST_LIST_CAP = 30

const PEPPER = process.env.BLITZPAY_AI_AUDIT_PEPPER ?? "blitzpay_ai_audit_pepper_dev_only"

export function canonicalizeForAiAudit(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort()
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = input[k]
  return JSON.stringify(out)
}

export function buildAiAuditImmutableHash(parts: Record<string, unknown>): string {
  const body = canonicalizeForAiAudit(parts)
  return createHash("sha256").update(PEPPER).update("|").update(body).digest("hex")
}

function phase4aInputFromReporting(r: BlitzpayOrgReportingSnapshot) {
  return {
    cashRunwayStatus: r.cashRunwayStatus,
    cashReserveGapCents: r.cashReserveGapCents,
    estimatedOperatingCashCents: r.estimatedOperatingCashCents,
    expectedInflows7dCents: r.expectedInflows7dCents,
    expectedInflows30dCents: r.expectedInflows30dCents,
    expectedOutflows30dCents: r.expectedOutflows30dCents,
    treasuryFailedPayoutCount30d: r.treasuryFailedPayoutCount30d,
    treasuryPendingPayoutTotalsCents: r.treasuryPendingPayoutTotalsCents,
    treasuryEstimateUpcomingTransferCents: r.treasuryEstimateUpcomingTransferCents,
    inventoryMarginHealthScore: r.inventoryMarginHealthScore,
    failedPaymentRate: r.failedPaymentRate,
    delinquencyRate: r.delinquencyRate,
    collectionSuccessRate: r.collectionSuccessRate,
    estimatedRecoverableOverdueCents: r.estimatedRecoverableOverdueCents,
    accountsReceivableCents: r.accountsReceivableCents,
    payrollLiabilityCents: r.payrollLiabilityCents,
    estimatedPayrollBurdenCents: r.estimatedPayrollBurdenCents,
    procurementTreasuryImpactScore: r.procurementTreasuryImpactScore,
    payableAgingHealthScore: r.payableAgingHealthScore,
    inventoryTurnoverScore: r.inventoryTurnoverScore,
    vendorConcentrationRisk: r.vendorConcentrationRisk,
    trialBalanceHealthy: r.trialBalanceHealthy,
    unreconciledBatchCount: r.unreconciledBatchCount,
    openDisputesAmountCents: r.openDisputesAmountCents,
    netCollectedCents: r.netCollectedCents,
    blitzpayChurnRiskScore0to100: r.blitzpayChurnRiskScore0to100,
    financingRiskScore: r.financingRiskScore,
  }
}

function buildHeuristicInsights(
  reporting: BlitzpayOrgReportingSnapshot,
  scores: ReturnType<typeof computeBlitzpayPhase4aReportingScores>,
): BlitzpayAiPrioritizedInsight[] {
  const rows: BlitzpayAiPrioritizedInsight[] = []

  if (scores.treasuryPressureScore >= 48) {
    rows.push({
      insight_type: "treasury_risk",
      severity: scores.treasuryPressureScore >= 72 ? "high" : "medium",
      deterministic_score: scores.treasuryPressureScore,
      title: "Treasury pressure is elevated",
      summary:
        "Near-term payouts, reserve gaps, or runway labels suggest tighter liquidity. Review payout timing and reserve targets — no automatic transfers are initiated from this insight.",
      recommendation_summary: "Schedule a treasury review with your admin and confirm payout cadence.",
      supporting_metrics: {
        treasury_pressure_score: scores.treasuryPressureScore,
        cash_runway_status: reporting.cashRunwayStatus,
        cash_reserve_gap_cents: reporting.cashReserveGapCents,
      },
      generated_by: "hybrid",
      ai_reasoning_summary: buildAdvisoryReasoningLine({
        insight_type: "treasury_risk",
        deterministic_score: scores.treasuryPressureScore,
        keyMetricLabel: "cash_runway_status",
        keyMetricValue: reporting.cashRunwayStatus,
      }),
    })
  }

  if (scores.marginRiskScore >= 44) {
    rows.push({
      insight_type: "margin_risk",
      severity: scores.marginRiskScore >= 68 ? "high" : "medium",
      deterministic_score: scores.marginRiskScore,
      title: "Margin / dispute signals need a second look",
      summary:
        "Inventory margin health and/or dispute exposure relative to collections suggests pricing, COGS, or dispute handling may need attention.",
      recommendation_summary: "Review margin-heavy jobs and open disputes with your finance lead.",
      supporting_metrics: {
        margin_risk_score: scores.marginRiskScore,
        inventory_margin_health_score: reporting.inventoryMarginHealthScore,
        open_disputes_amount_cents: reporting.openDisputesAmountCents,
      },
      generated_by: "hybrid",
      ai_reasoning_summary: buildAdvisoryReasoningLine({
        insight_type: "margin_risk",
        deterministic_score: scores.marginRiskScore,
        keyMetricLabel: "inventory_margin_health_score",
        keyMetricValue: reporting.inventoryMarginHealthScore,
      }),
    })
  }

  if (scores.collectionsOptimizationScore >= 38) {
    rows.push({
      insight_type: "collections",
      severity: scores.collectionsOptimizationScore >= 62 ? "high" : "medium",
      deterministic_score: scores.collectionsOptimizationScore,
      title: "Collections optimization opportunity",
      summary:
        "There is headroom to improve recovery rates, delinquency, or failed-payment handling using your existing BlitzPay collections tooling — recommendations only.",
      recommendation_summary: "Prioritize overdue balances with the collections queue and confirm autopay coverage.",
      supporting_metrics: {
        collections_optimization_score: scores.collectionsOptimizationScore,
        collection_success_rate: reporting.collectionSuccessRate,
        failed_payment_rate: reporting.failedPaymentRate,
      },
      generated_by: "hybrid",
      ai_reasoning_summary: buildAdvisoryReasoningLine({
        insight_type: "collections",
        deterministic_score: scores.collectionsOptimizationScore,
        keyMetricLabel: "collection_success_rate",
        keyMetricValue: Math.round(reporting.collectionSuccessRate),
      }),
    })
  }

  if (scores.payrollPressureScore >= 42) {
    rows.push({
      insight_type: "payroll",
      severity: scores.payrollPressureScore >= 65 ? "high" : "medium",
      deterministic_score: scores.payrollPressureScore,
      title: "Payroll accrual pressure versus cash",
      summary:
        "Payroll-style liabilities are meaningful relative to internal operating cash estimates. Plan contractor settlements and commission timing deliberately.",
      recommendation_summary: "Review draft payroll runs and settlement backlog in BlitzPay payroll tools.",
      supporting_metrics: {
        payroll_pressure_score: scores.payrollPressureScore,
        payroll_liability_cents: reporting.payrollLiabilityCents,
        estimated_operating_cash_cents: reporting.estimatedOperatingCashCents,
      },
      generated_by: "deterministic_engine",
      ai_reasoning_summary: null,
    })
  }

  if (scores.procurementEfficiencyScore < 48) {
    rows.push({
      insight_type: "procurement",
      severity: scores.procurementEfficiencyScore < 32 ? "high" : "medium",
      deterministic_score: 100 - scores.procurementEfficiencyScore,
      title: "Procurement planning efficiency is below target",
      summary:
        "Reorder exposure, payable aging, or inventory turnover signals suggest procurement planning deserves a focused pass (no auto-purchasing).",
      recommendation_summary: "Validate reorder forecasts and vendor bill aging with your operations lead.",
      supporting_metrics: {
        procurement_efficiency_score: scores.procurementEfficiencyScore,
        procurement_treasury_impact_score: reporting.procurementTreasuryImpactScore,
        reorder_exposure_cents: reporting.reorderExposureCents,
      },
      generated_by: "deterministic_engine",
      ai_reasoning_summary: null,
    })
  }

  if (reporting.blitzpayChurnRiskScore0to100 >= 52) {
    rows.push({
      insight_type: "membership",
      severity: reporting.blitzpayChurnRiskScore0to100 >= 72 ? "high" : "medium",
      deterministic_score: reporting.blitzpayChurnRiskScore0to100,
      title: "Membership renewal / pricing risk",
      summary:
        "Churn-risk indicators for recurring memberships are elevated. Consider renewal outreach and pricing alignment — no automatic customer contact is performed here.",
      recommendation_summary: "Review membership renewals, failed payments, and plan pricing with your team.",
      supporting_metrics: {
        churn_risk_score: reporting.blitzpayChurnRiskScore0to100,
        renewal_pipeline_cents: reporting.renewalPipelineCents,
      },
      generated_by: "hybrid",
      ai_reasoning_summary: buildAdvisoryReasoningLine({
        insight_type: "membership",
        deterministic_score: reporting.blitzpayChurnRiskScore0to100,
        keyMetricLabel: "renewal_pipeline_cents",
        keyMetricValue: reporting.renewalPipelineCents,
      }),
    })
  }

  if (reporting.financingRiskScore >= 48) {
    rows.push({
      insight_type: "financing",
      severity: reporting.financingRiskScore >= 70 ? "high" : "medium",
      deterministic_score: reporting.financingRiskScore,
      title: "Financing marketplace exposure signal",
      summary:
        "Financing-related risk scores from marketplace orchestration data are elevated. This does not approve or decline financing automatically.",
      recommendation_summary: "Review open financing applications and contractor advance planning models.",
      supporting_metrics: {
        financing_risk_score: reporting.financingRiskScore,
        contractor_advance_exposure: reporting.contractorAdvanceExposure,
      },
      generated_by: "deterministic_engine",
      ai_reasoning_summary: null,
    })
  }

  if (scores.vendorConcentrationRiskScore >= 58) {
    rows.push({
      insight_type: "vendor_risk",
      severity: scores.vendorConcentrationRiskScore >= 78 ? "high" : "medium",
      deterministic_score: scores.vendorConcentrationRiskScore,
      title: "Vendor concentration and payables risk",
      summary:
        "Vendor concentration metrics indicate payables are skewed toward a small supplier set — diversify where practical.",
      recommendation_summary: "Review top vendors and bill approval thresholds in AP tools.",
      supporting_metrics: {
        vendor_concentration_risk_score: scores.vendorConcentrationRiskScore,
        accounts_payable_outstanding_cents: reporting.accountsPayableOutstandingCents,
      },
      generated_by: "deterministic_engine",
      ai_reasoning_summary: null,
    })
  }

  return rows
}

function anomaliesAsInsights(reporting: BlitzpayOrgReportingSnapshot): BlitzpayAiPrioritizedInsight[] {
  return detectBlitzpayFinancialAnomalies(reporting).map((a) => ({
    insight_type: "anomaly" as const,
    severity: a.severity,
    deterministic_score: a.score0to100,
    title: a.title,
    summary: a.summary,
    recommendation_summary: "Review supporting metrics and confirm with finance before operational changes.",
    supporting_metrics: { ...a.metrics, anomaly_code: a.code },
    generated_by: "deterministic_engine" as const,
    ai_reasoning_summary: null,
  }))
}

function executiveInsight(
  reporting: BlitzpayOrgReportingSnapshot,
  scores: ReturnType<typeof computeBlitzpayPhase4aReportingScores>,
): BlitzpayAiPrioritizedInsight {
  const ex = buildExecutiveFinancialSummaryLines(reporting, scores)
  const sev: BlitzpayAiPrioritizedInsight["severity"] =
    scores.aiFinancialRiskScore >= 75 ? "critical" : scores.aiFinancialRiskScore >= 55 ? "high" : scores.aiFinancialRiskScore >= 40 ? "medium" : "low"
  return {
    insight_type: "executive_summary",
    severity: sev,
    deterministic_score: scores.aiFinancialRiskScore,
    title: ex.title,
    summary: `${ex.summary} ${ex.bullets.join(" ")}`,
    recommendation_summary: "Share this snapshot with ownership; decisions remain manual.",
    supporting_metrics: {
      ai_financial_risk_score: scores.aiFinancialRiskScore,
      treasury_pressure_score: scores.treasuryPressureScore,
      margin_risk_score: scores.marginRiskScore,
      collections_optimization_score: scores.collectionsOptimizationScore,
      payroll_pressure_score: scores.payrollPressureScore,
      procurement_efficiency_score: scores.procurementEfficiencyScore,
      vendor_concentration_risk_score: scores.vendorConcentrationRiskScore,
      ai_insight_coverage_rate: scores.aiInsightCoverageRate,
    },
    generated_by: "deterministic_engine",
    ai_reasoning_summary: null,
  }
}

export function composeBlitzpayAiPrioritizedInsights(reporting: BlitzpayOrgReportingSnapshot): BlitzpayAiPrioritizedInsight[] {
  const scores = computeBlitzpayPhase4aReportingScores(phase4aInputFromReporting(reporting))
  const merged = [...anomaliesAsInsights(reporting), ...buildHeuristicInsights(reporting, scores), executiveInsight(reporting, scores)]
  return sortInsightsDeterministic(merged).slice(0, 24)
}

async function insertAudit(
  admin: SupabaseClient,
  row: {
    organization_id: string
    audit_type: string
    related_entity_type?: string | null
    related_entity_id?: string | null
    actor_type: "system" | "admin" | "user"
    actor_id?: string | null
    audit_summary: string
    metadata?: Record<string, unknown>
  },
) {
  const hash = buildAiAuditImmutableHash({
    audit_type: row.audit_type,
    organization_id: row.organization_id,
    related_entity_type: row.related_entity_type ?? null,
    related_entity_id: row.related_entity_id ?? null,
    audit_summary: row.audit_summary,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    metadata: row.metadata ?? {},
  })
  const { error } = await admin.from("blitzpay_ai_audit_log").insert({
    organization_id: row.organization_id,
    audit_type: row.audit_type,
    related_entity_type: row.related_entity_type ?? null,
    related_entity_id: row.related_entity_id ?? null,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    audit_summary: row.audit_summary,
    immutable_hash: hash,
    metadata: row.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function regenerateBlitzpayAiFinancialCopilotArtifacts(
  admin: SupabaseClient,
  organizationId: string,
  options?: { windowDays?: number; actorType?: "system" | "admin" | "user"; actorId?: string | null },
): Promise<{ insightsInserted: number; forecastsInserted: number; actionsInserted: number }> {
  assertUuid(organizationId, "organizationId")
  const windowDays = Math.min(90, Math.max(7, Math.round(options?.windowDays ?? 30)))
  const sinceIso = new Date(Date.now() - windowDays * 86400_000).toISOString()
  const { fetchBlitzpayOrgReportingSnapshot } = await import("@/lib/blitzpay/blitzpay-reporting-snapshot")
  const reporting = await fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso })
  const insights = composeBlitzpayAiPrioritizedInsights(reporting)
  const forecasts = buildBlitzpayAiForecastSnapshots(reporting, windowDays)

  const { error: archErr } = await admin
    .from("blitzpay_ai_financial_insights")
    .update({ insight_status: "archived", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("insight_status", "active")
  if (archErr) throw new Error(archErr.message)

  const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString()
  let insightsInserted = 0
  let actionsInserted = 0

  for (const ins of insights) {
    const { data: insRow, error: insErr } = await admin
      .from("blitzpay_ai_financial_insights")
      .insert({
        organization_id: organizationId,
        insight_type: ins.insight_type,
        insight_status: "active",
        severity: ins.severity,
        title: ins.title,
        summary: ins.summary,
        deterministic_score: ins.deterministic_score,
        supporting_metrics: ins.supporting_metrics,
        recommendation_summary: ins.recommendation_summary,
        generated_by: ins.generated_by,
        generated_at: new Date().toISOString(),
        expires_at: expiresAt,
        metadata: { engine: "phase_4a_v1", window_days: windowDays },
      })
      .select("id")
      .single()
    if (insErr) throw new Error(insErr.message)
    const insightId = (insRow as { id: string }).id
    insightsInserted += 1

    const actionType = defaultActionTypeForInsight(ins.insight_type as BlitzpayAiInsightType)
    const { error: actErr } = await admin.from("blitzpay_ai_recommendation_actions").insert({
      organization_id: organizationId,
      insight_id: insightId,
      action_status: "pending",
      action_type: actionType,
      action_summary: ins.recommendation_summary,
      deterministic_basis: { deterministic_score: ins.deterministic_score, supporting_metrics: ins.supporting_metrics },
      ai_reasoning_summary: ins.ai_reasoning_summary,
      metadata: {},
    })
    if (actErr) throw new Error(actErr.message)
    actionsInserted += 1
  }

  let forecastsInserted = 0
  for (const f of forecasts) {
    const { error: fErr } = await admin.from("blitzpay_ai_forecast_snapshots").insert({
      organization_id: organizationId,
      snapshot_type: f.snapshot_type,
      forecast_window_days: f.forecast_window_days,
      forecast_confidence_score: f.forecast_confidence_score,
      projected_inflow_cents: f.projected_inflow_cents,
      projected_outflow_cents: f.projected_outflow_cents,
      projected_net_cents: f.projected_net_cents,
      projected_risk_score: f.projected_risk_score,
      deterministic_inputs: f.deterministic_inputs,
      metadata: {},
    })
    if (fErr) throw new Error(fErr.message)
    forecastsInserted += 1
  }

  await insertAudit(admin, {
    organization_id: organizationId,
    audit_type: "forecast_generated",
    actor_type: options?.actorType ?? "system",
    actor_id: options?.actorId ?? null,
    audit_summary: `Generated ${forecastsInserted} deterministic forecast snapshots (${windowDays}d window).`,
    metadata: { window_days: windowDays },
  })

  await insertAudit(admin, {
    organization_id: organizationId,
    audit_type: "executive_summary_generated",
    actor_type: options?.actorType ?? "system",
    actor_id: options?.actorId ?? null,
    audit_summary: "Regenerated executive financial summary artifacts.",
  })

  await insertAudit(admin, {
    organization_id: organizationId,
    audit_type: "insight_generated",
    actor_type: options?.actorType ?? "system",
    actor_id: options?.actorId ?? null,
    audit_summary: `Copilot regeneration wrote ${insightsInserted} insights and ${actionsInserted} recommendation rows.`,
    metadata: { insightsInserted, actionsInserted, window_days: windowDays },
  })

  return { insightsInserted, forecastsInserted, actionsInserted }
}

export async function fetchBlitzpayAiInsightsForOrg(
  admin: SupabaseClient,
  organizationId: string,
  opts?: { status?: "active" | "all"; limit?: number },
) {
  assertUuid(organizationId, "organizationId")
  const limit = Math.min(BLITZPAY_AI_FIN_COPILOT_LIST_CAP, Math.max(1, opts?.limit ?? 40))
  let q = admin
    .from("blitzpay_ai_financial_insights")
    .select(
      "id, organization_id, insight_type, insight_status, severity, title, summary, deterministic_score, supporting_metrics, recommendation_summary, generated_by, generated_at, expires_at, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("generated_at", { ascending: false })
    .limit(limit)
  if (opts?.status !== "all") {
    q = q.eq("insight_status", "active")
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchBlitzpayAiRecommendationsForOrg(admin: SupabaseClient, organizationId: string, limit = 40) {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(BLITZPAY_AI_FIN_COPILOT_LIST_CAP, Math.max(1, limit))
  const { data, error } = await admin
    .from("blitzpay_ai_recommendation_actions")
    .select(
      "id, organization_id, insight_id, action_status, action_type, assigned_user_id, action_summary, deterministic_basis, ai_reasoning_summary, completed_at, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchBlitzpayAiForecastsForOrg(admin: SupabaseClient, organizationId: string, limit = 20) {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(BLITZPAY_AI_FORECAST_LIST_CAP, Math.max(1, limit))
  const { data, error } = await admin
    .from("blitzpay_ai_forecast_snapshots")
    .select(
      "id, organization_id, snapshot_type, forecast_window_days, forecast_confidence_score, projected_inflow_cents, projected_outflow_cents, projected_net_cents, projected_risk_score, deterministic_inputs, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function dismissBlitzpayAiInsight(
  admin: SupabaseClient,
  organizationId: string,
  insightId: string,
  actor: { actorType: "admin" | "user"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(insightId, "insightId")
  assertUuid(actor.actorId, "actorId")
  const { error } = await admin
    .from("blitzpay_ai_financial_insights")
    .update({ insight_status: "dismissed", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", insightId)
  if (error) throw new Error(error.message)
  await insertAudit(admin, {
    organization_id: organizationId,
    audit_type: "manual_override",
    related_entity_type: "insight",
    related_entity_id: insightId,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: "Insight dismissed by user (advisory queue only).",
  })
}

export async function acknowledgeBlitzpayAiRecommendation(
  admin: SupabaseClient,
  organizationId: string,
  recommendationId: string,
  actor: { actorType: "admin" | "user"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(recommendationId, "recommendationId")
  assertUuid(actor.actorId, "actorId")
  const { error } = await admin
    .from("blitzpay_ai_recommendation_actions")
    .update({ action_status: "acknowledged", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", recommendationId)
  if (error) throw new Error(error.message)
  await insertAudit(admin, {
    organization_id: organizationId,
    audit_type: "recommendation_accepted",
    related_entity_type: "recommendation_action",
    related_entity_id: recommendationId,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: "Recommendation acknowledged (advisory queue; no execution).",
  })
}

export async function completeBlitzpayAiRecommendation(
  admin: SupabaseClient,
  organizationId: string,
  recommendationId: string,
  actor: { actorType: "admin" | "user"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(recommendationId, "recommendationId")
  assertUuid(actor.actorId, "actorId")
  const now = new Date().toISOString()
  const { error } = await admin
    .from("blitzpay_ai_recommendation_actions")
    .update({ action_status: "completed", completed_at: now, updated_at: now })
    .eq("organization_id", organizationId)
    .eq("id", recommendationId)
  if (error) throw new Error(error.message)
  await insertAudit(admin, {
    organization_id: organizationId,
    audit_type: "manual_override",
    related_entity_type: "recommendation_action",
    related_entity_id: recommendationId,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: "Recommendation marked completed by user (manual bookkeeping).",
  })
}

export async function fetchBlitzpayAiExecutiveSummaryPayload(
  admin: SupabaseClient,
  organizationId: string,
  windowDays?: number,
) {
  assertUuid(organizationId, "organizationId")
  const wd = Math.min(90, Math.max(7, Math.round(windowDays ?? 30)))
  const sinceIso = new Date(Date.now() - wd * 86400_000).toISOString()
  const { fetchBlitzpayOrgReportingSnapshot } = await import("@/lib/blitzpay/blitzpay-reporting-snapshot")
  const reporting = await fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso })
  const scores = computeBlitzpayPhase4aReportingScores(phase4aInputFromReporting(reporting))
  const lines = buildExecutiveFinancialSummaryLines(reporting, scores)
  return {
    generatedAt: new Date().toISOString(),
    windowDays: wd,
    scores,
    executive: lines,
    reportingEcho: {
      cashRunwayStatus: reporting.cashRunwayStatus,
      netCollectedCents: reporting.netCollectedCents,
      trialBalanceHealthy: reporting.trialBalanceHealthy,
    },
  }
}

export async function fetchBlitzpayAiCopilotHealth(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const [{ count: activeInsights }, { count: pendingActions }] = await Promise.all([
    admin
      .from("blitzpay_ai_financial_insights")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("insight_status", "active"),
    admin
      .from("blitzpay_ai_recommendation_actions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("action_status", "pending"),
  ])
  return {
    ok: true as const,
    organizationId,
    activeInsightCount: activeInsights ?? 0,
    pendingRecommendationCount: pendingActions ?? 0,
  }
}
