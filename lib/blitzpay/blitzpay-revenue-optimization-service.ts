import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import {
  buildRevenueOptimizationAuditHash,
  composeRevenueOptimizationOpportunities,
  defaultActionTypeForOpportunity,
  normalizeRevenueOptimizationContext,
  type RevenueOpportunityDraft,
} from "@/lib/blitzpay/blitzpay-revenue-optimization-metrics"
import {
  computeAchNudgeFitScore0to100,
  computeAutopayFitScore0to100,
  computeFinancingFitScore0to100,
  computeLatePaymentRiskScore0to100,
  computePaymentReliabilityScore0to100,
  computeRenewalRiskScore0to100,
  type CustomerInvoiceSignals,
} from "@/lib/blitzpay/blitzpay-customer-payment-behavior"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"

export const BLITZPAY_REV_OPT_LIST_CAP = 50
export const BLITZPAY_REV_OPT_BEHAVIOR_CUSTOMER_CAP = 40
export const BLITZPAY_REV_OPT_INVOICES_PER_CUSTOMER_CAP = 40

async function insertRevOptAudit(
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
  const hash = buildRevenueOptimizationAuditHash({
    audit_type: row.audit_type,
    organization_id: row.organization_id,
    related_entity_type: row.related_entity_type ?? null,
    related_entity_id: row.related_entity_id ?? null,
    audit_summary: row.audit_summary,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    metadata: row.metadata ?? {},
  })
  const { error } = await admin.from("blitzpay_revenue_optimization_audit_log").insert({
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

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10)
}

function isoWithinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return false
  return t >= Date.now() - days * 86400_000
}

async function upsertCustomerBehaviorScore(
  admin: SupabaseClient,
  organizationId: string,
  customerId: string,
  orgChurn: number,
  financingReadyQuotes: number,
): Promise<void> {
  const since = new Date(Date.now() - 90 * 86400_000).toISOString().slice(0, 10)
  const { data: inv, error: invErr } = await admin
    .from("org_invoices")
    .select("status, amount_cents, paid_at, issued_at")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .limit(BLITZPAY_REV_OPT_INVOICES_PER_CUSTOMER_CAP)
  if (invErr) throw new Error(invErr.message)
  const rows = (inv ?? []) as Array<{ status: string; amount_cents: number; paid_at: string | null; issued_at: string }>
  let openNonPaid = 0
  let overdue = 0
  let paid90 = 0
  let openCents = 0
  for (const r of rows) {
    if (r.status === "sent" || r.status === "overdue") {
      openNonPaid += 1
      openCents += Math.max(0, Math.round(Number(r.amount_cents)))
    }
    if (r.status === "overdue") overdue += 1
    if (r.status === "paid" && r.paid_at && isoWithinDays(r.paid_at, 90)) paid90 += 1
  }

  const { data: prof } = await admin
    .from("blitzpay_customer_billing_profiles")
    .select("autopay_enabled, default_payment_method_type")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .maybeSingle()
  const p = prof as { autopay_enabled?: boolean; default_payment_method_type?: string | null } | null
  const hasSaved = Boolean(p?.default_payment_method_type)
  const autopay = Boolean(p?.autopay_enabled)

  const signals: CustomerInvoiceSignals = {
    openNonPaidCount: openNonPaid,
    overdueCount: overdue,
    paidLast90dCount: paid90,
    totalOpenCents: openCents,
    hasSavedPaymentMethod: hasSaved,
    autopayEnrolled: autopay,
  }

  const scoreDate = todayYmd()
  const supporting = {
    open_non_paid: openNonPaid,
    overdue,
    paid_90d: paid90,
    open_cents: openCents,
  }

  const { error } = await admin.from("blitzpay_customer_payment_behavior_scores").upsert(
    {
      organization_id: organizationId,
      customer_id: customerId,
      score_date: scoreDate,
      payment_reliability_score: computePaymentReliabilityScore0to100(signals),
      late_payment_risk_score: computeLatePaymentRiskScore0to100(signals),
      autopay_fit_score: computeAutopayFitScore0to100(signals),
      ach_nudge_fit_score: computeAchNudgeFitScore0to100(signals),
      renewal_risk_score: computeRenewalRiskScore0to100(signals, orgChurn),
      financing_fit_score: computeFinancingFitScore0to100(signals, financingReadyQuotes),
      supporting_metrics: supporting,
      metadata: { engine: "phase_4b_v1", window_days: 90, since_issued: since },
    },
    { onConflict: "organization_id,customer_id,score_date" },
  )
  if (error) throw new Error(error.message)
}

function opportunityRowFromDraft(
  organizationId: string,
  d: RevenueOpportunityDraft,
  expiresAt: string | null,
): Record<string, unknown> {
  return {
    organization_id: organizationId,
    opportunity_type: d.opportunity_type,
    opportunity_status: "active",
    priority: d.priority,
    title: d.title,
    summary: d.summary,
    deterministic_score: d.deterministic_score,
    estimated_revenue_impact_cents: d.estimated_revenue_impact_cents,
    confidence_score: d.confidence_score,
    supporting_metrics: d.supporting_metrics,
    recommended_action: d.recommended_action,
    source_type: "reporting_snapshot",
    source_id: null,
    expires_at: expiresAt,
    metadata: {},
  }
}

export async function generateRevenueOptimizationArtifacts(
  admin: SupabaseClient,
  organizationId: string,
  options?: { actorType?: "system" | "admin" | "user"; actorId?: string | null },
): Promise<{ opportunitiesInserted: number; behaviorScoresUpserted: number }> {
  assertUuid(organizationId, "organizationId")
  const { fetchBlitzpayOrgReportingSnapshot } = await import("@/lib/blitzpay/blitzpay-reporting-snapshot")
  const sinceIso = new Date(Date.now() - 30 * 86400_000).toISOString()
  const snap = await fetchBlitzpayOrgReportingSnapshot(admin, organizationId, { sinceIso })
  const ctx = normalizeRevenueOptimizationContext({
    achAccelerationOpportunityCents: snap.achAccelerationOpportunityCents,
    reminderConversionRatePct: snap.reminderConversionRatePct,
    fieldCollectionRecoveryRatePct: snap.fieldCollectionRecoveryRatePct,
    recoveryFlowCompletionRate: snap.recoveryFlowCompletionRate,
    failedPaymentRate: snap.failedPaymentRate,
    blitzpayChurnRiskScore0to100: snap.blitzpayChurnRiskScore0to100,
    renewalPipelineCents: snap.renewalPipelineCents,
    recurringRevenueCents: snap.recurringRevenueCents,
    delinquentMembershipRevenueCents: snap.delinquentMembershipRevenueCents,
    membershipAutoPayAdoptionBasisPoints: snap.membershipAutoPayAdoptionBasisPoints,
    savedPaymentMethodRate: snap.savedPaymentMethodRate,
    autopayEnrollmentRate: snap.autopayEnrollmentRate,
    technicianAssistedRecoveryRatePct: snap.technicianAssistedRecoveryRatePct,
    likelyFieldCollectibleCents: snap.likelyFieldCollectibleCents,
    workOrdersWithCollectibleBalancesCount: snap.workOrdersWithCollectibleBalancesCount,
    financingReadyQuotesCount: snap.financingReadyQuotesCount,
    financingRevenueOpportunity: snap.financingRevenueOpportunity,
    estimatedRecoverableOverdueCents: snap.estimatedRecoverableOverdueCents,
    collectionSuccessRate: snap.collectionSuccessRate,
    billingReadinessRate: snap.billingReadinessRate,
  })

  const { error: archErr } = await admin
    .from("blitzpay_revenue_optimization_opportunities")
    .update({ opportunity_status: "archived", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("opportunity_status", "active")
  if (archErr) throw new Error(archErr.message)

  const drafts = composeRevenueOptimizationOpportunities(ctx)
  const expiresAt = new Date(Date.now() + 14 * 86400_000).toISOString()
  let opportunitiesInserted = 0

  for (const d of drafts) {
    const { data: row, error: oErr } = await admin
      .from("blitzpay_revenue_optimization_opportunities")
      .insert(opportunityRowFromDraft(organizationId, d, expiresAt))
      .select("id")
      .single()
    if (oErr) throw new Error(oErr.message)
    const oid = (row as { id: string }).id
    opportunitiesInserted += 1

    const at = defaultActionTypeForOpportunity(d.opportunity_type)
    const summaryLine = (d.recommended_action && d.recommended_action.trim()) || d.title
    const { error: aErr } = await admin.from("blitzpay_revenue_optimization_actions").insert({
      organization_id: organizationId,
      opportunity_id: oid,
      action_status: "pending",
      action_type: at,
      action_summary: summaryLine,
      deterministic_basis: { deterministic_score: d.deterministic_score, supporting_metrics: d.supporting_metrics },
      metadata: {},
    })
    if (aErr) throw new Error(aErr.message)
  }

  if (opportunitiesInserted > 0) {
    await insertRevOptAudit(admin, {
      organization_id: organizationId,
      audit_type: "action_created",
      actor_type: options?.actorType ?? "system",
      actor_id: options?.actorId ?? null,
      audit_summary: `Created ${opportunitiesInserted} pending revenue optimization actions (one per opportunity).`,
      metadata: { pending_actions: opportunitiesInserted },
    })
  }

  let behaviorScoresUpserted = 0
  const { data: custRows, error: cErr } = await admin
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_REV_OPT_BEHAVIOR_CUSTOMER_CAP)
  if (!cErr && custRows) {
    for (const c of custRows as Array<{ id: string }>) {
      await upsertCustomerBehaviorScore(
        admin,
        organizationId,
        c.id,
        snap.blitzpayChurnRiskScore0to100,
        snap.financingReadyQuotesCount,
      )
      behaviorScoresUpserted += 1
    }
  }

  await insertRevOptAudit(admin, {
    organization_id: organizationId,
    audit_type: "opportunity_generated",
    actor_type: options?.actorType ?? "system",
    actor_id: options?.actorId ?? null,
    audit_summary: `Generated ${opportunitiesInserted} revenue optimization opportunities and refreshed ${behaviorScoresUpserted} customer behavior score rows (bounded).`,
    metadata: { opportunitiesInserted, behaviorScoresUpserted },
  })

  if (behaviorScoresUpserted > 0) {
    await insertRevOptAudit(admin, {
      organization_id: organizationId,
      audit_type: "behavior_score_generated",
      actor_type: options?.actorType ?? "system",
      actor_id: options?.actorId ?? null,
      audit_summary: `Upserted ${behaviorScoresUpserted} payment behavior score rows.`,
    })
  }

  return { opportunitiesInserted, behaviorScoresUpserted }
}

export async function fetchRevenueOptimizationOpportunities(
  admin: SupabaseClient,
  organizationId: string,
  opts?: { status?: "active" | "all"; limit?: number },
) {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(BLITZPAY_REV_OPT_LIST_CAP, Math.max(1, opts?.limit ?? 40))
  let q = admin
    .from("blitzpay_revenue_optimization_opportunities")
    .select(
      "id, organization_id, opportunity_type, opportunity_status, priority, title, summary, deterministic_score, estimated_revenue_impact_cents, confidence_score, supporting_metrics, recommended_action, source_type, source_id, expires_at, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (opts?.status !== "all") q = q.eq("opportunity_status", "active")
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchRevenueOptimizationActions(admin: SupabaseClient, organizationId: string, limit = 40) {
  assertUuid(organizationId, "organizationId")
  const lim = Math.min(BLITZPAY_REV_OPT_LIST_CAP, Math.max(1, limit))
  const { data, error } = await admin
    .from("blitzpay_revenue_optimization_actions")
    .select(
      "id, organization_id, opportunity_id, action_status, action_type, assigned_user_id, action_summary, deterministic_basis, completed_at, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(lim)
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchRevenueOptimizationExperiments(admin: SupabaseClient, organizationId: string, limit = 30) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_revenue_optimization_experiments")
    .select(
      "id, organization_id, experiment_name, experiment_type, experiment_status, start_date, end_date, control_strategy, treatment_strategy, success_metric, baseline_value, observed_value, estimated_lift_basis_points, metadata, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(Math.min(50, Math.max(1, limit)))
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchPaymentBehaviorScores(admin: SupabaseClient, organizationId: string, limit = 40) {
  assertUuid(organizationId, "organizationId")
  const { data, error } = await admin
    .from("blitzpay_customer_payment_behavior_scores")
    .select(
      "id, organization_id, customer_id, score_date, payment_reliability_score, late_payment_risk_score, autopay_fit_score, ach_nudge_fit_score, renewal_risk_score, financing_fit_score, supporting_metrics, metadata, created_at",
    )
    .eq("organization_id", organizationId)
    .order("score_date", { ascending: false })
    .limit(Math.min(BLITZPAY_REV_OPT_LIST_CAP, Math.max(1, limit)))
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function dismissRevenueOptimizationOpportunity(
  admin: SupabaseClient,
  organizationId: string,
  opportunityId: string,
  actor: { actorType: "user" | "admin"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(opportunityId, "opportunityId")
  assertUuid(actor.actorId, "actorId")
  const { error } = await admin
    .from("blitzpay_revenue_optimization_opportunities")
    .update({ opportunity_status: "dismissed", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", opportunityId)
  if (error) throw new Error(error.message)
  await insertRevOptAudit(admin, {
    organization_id: organizationId,
    audit_type: "opportunity_dismissed",
    related_entity_type: "opportunity",
    related_entity_id: opportunityId,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: "Revenue optimization opportunity dismissed.",
  })
}

export async function acknowledgeRevenueOptimizationAction(
  admin: SupabaseClient,
  organizationId: string,
  actionId: string,
  actor: { actorType: "user" | "admin"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(actionId, "actionId")
  assertUuid(actor.actorId, "actorId")
  const { error } = await admin
    .from("blitzpay_revenue_optimization_actions")
    .update({ action_status: "acknowledged", updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("id", actionId)
  if (error) throw new Error(error.message)
  await insertRevOptAudit(admin, {
    organization_id: organizationId,
    audit_type: "action_acknowledged",
    related_entity_type: "action",
    related_entity_id: actionId,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: "Revenue optimization action acknowledged (no execution).",
  })
}

export async function completeRevenueOptimizationAction(
  admin: SupabaseClient,
  organizationId: string,
  actionId: string,
  actor: { actorType: "user" | "admin"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(actionId, "actionId")
  assertUuid(actor.actorId, "actorId")
  const now = new Date().toISOString()
  const { error } = await admin
    .from("blitzpay_revenue_optimization_actions")
    .update({ action_status: "completed", completed_at: now, updated_at: now })
    .eq("organization_id", organizationId)
    .eq("id", actionId)
  if (error) throw new Error(error.message)
  await insertRevOptAudit(admin, {
    organization_id: organizationId,
    audit_type: "action_completed",
    related_entity_type: "action",
    related_entity_id: actionId,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: "Revenue optimization action marked completed.",
  })
}

export async function createRevenueOptimizationExperiment(
  admin: SupabaseClient,
  organizationId: string,
  body: {
    experiment_name: string
    experiment_type: string
    experiment_status?: string
    start_date?: string | null
    end_date?: string | null
    control_strategy?: string | null
    treatment_strategy?: string | null
    success_metric?: string | null
    baseline_value?: number | null
    observed_value?: number | null
    estimated_lift_basis_points?: number | null
    metadata?: Record<string, unknown>
  },
  actor: { actorType: "user" | "admin"; actorId: string },
) {
  assertUuid(organizationId, "organizationId")
  assertUuid(actor.actorId, "actorId")
  const { data, error } = await admin
    .from("blitzpay_revenue_optimization_experiments")
    .insert({
      organization_id: organizationId,
      experiment_name: body.experiment_name.trim().slice(0, 200),
      experiment_type: body.experiment_type,
      experiment_status: body.experiment_status ?? "draft",
      start_date: body.start_date ?? null,
      end_date: body.end_date ?? null,
      control_strategy: body.control_strategy ?? null,
      treatment_strategy: body.treatment_strategy ?? null,
      success_metric: body.success_metric ?? null,
      baseline_value: body.baseline_value ?? null,
      observed_value: body.observed_value ?? null,
      estimated_lift_basis_points: body.estimated_lift_basis_points ?? null,
      metadata: body.metadata ?? {},
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  const id = (data as { id: string }).id
  await insertRevOptAudit(admin, {
    organization_id: organizationId,
    audit_type: "experiment_created",
    related_entity_type: "experiment",
    related_entity_id: id,
    actor_type: actor.actorType,
    actor_id: actor.actorId,
    audit_summary: `Created revenue optimization experiment: ${body.experiment_name.slice(0, 120)}`,
  })
  return id
}

export async function fetchRevenueOptimizationHealth(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const [{ count: activeOpp }, { count: pendingAct }, { count: expDraft }] = await Promise.all([
    admin
      .from("blitzpay_revenue_optimization_opportunities")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("opportunity_status", "active"),
    admin
      .from("blitzpay_revenue_optimization_actions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("action_status", "pending"),
    admin
      .from("blitzpay_revenue_optimization_experiments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .in("experiment_status", ["draft", "active", "paused"]),
  ])
  return {
    ok: true as const,
    organizationId,
    activeOpportunityCount: activeOpp ?? 0,
    pendingActionCount: pendingAct ?? 0,
    activeOrDraftExperimentCount: expDraft ?? 0,
  }
}
