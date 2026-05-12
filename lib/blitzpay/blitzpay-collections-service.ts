import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { hashStripeReference } from "@/lib/blitzpay/blitzpay-billing-profiles"
import {
  BLITZPAY_COLLECTION_ACTIVITY_LIST_CAP,
  BLITZPAY_COLLECTION_ATTEMPT_LIST_CAP,
  BLITZPAY_COLLECTION_FLOW_LIST_CAP,
  BLITZPAY_COLLECTION_STATE_LIST_CAP,
  BLITZPAY_PHASE_3B_REPORTING_SCAN_CAP,
  type CollectionStateStatus,
  computeCollectionHealthBand,
  computeCollectionHealthScore0to100,
  computeEscalationLevel,
  computeNextRetryAtFromFirstFailure,
  computeRecoveryReadiness,
  computeRetryEligibility,
  deriveCollectionStatusFromInvoice,
  humanCollectionStatusLabel,
  phase3bReportingMetrics,
  categorizePaymentFailure,
  MAX_DETERMINISTIC_RETRY_SLOTS,
  MAX_PAYMENT_ATTEMPT_COUNT,
} from "@/lib/blitzpay/blitzpay-collections-engine"

export type SafeCollectionStateRow = {
  id: string
  invoiceId: string
  customerId: string
  invoiceNumber: string | null
  invoiceTitle: string | null
  amountCents: number
  invoiceStatus: string
  dueDate: string | null
  collectionStatus: CollectionStateStatus
  statusLabel: string
  paymentAttemptCount: number
  failedAttemptCount: number
  nextRetryAt: string | null
  lastAttemptedAt: string | null
  lastSuccessfulPaymentAt: string | null
  lastFailureCategory: string | null
  escalationLevel: number
  recoveryPaused: boolean
  autopayEnabled: boolean
  recoveryReadiness: ReturnType<typeof computeRecoveryReadiness>
  derivedStatus: CollectionStateStatus
  firstFailureAt: string | null
}

export type SafeCollectionAttemptRow = {
  id: string
  invoiceId: string
  attemptType: string
  attemptStatus: string
  amountCents: number
  currency: string
  failureCategory: string | null
  attemptedAt: string
  retryEligible: boolean
}

export type SafeRecoveryFlowRow = {
  id: string
  invoiceId: string | null
  flowStatus: string
  triggerType: string
  nextActionAt: string | null
  lastActionAt: string | null
}

export type SafeActivityRow = {
  id: string
  activityType: string
  activitySummary: string
  actorType: string
  createdAt: string
  invoiceId: string | null
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

async function appendActivity(
  admin: SupabaseClient,
  input: {
    organizationId: string
    invoiceId: string | null
    customerId: string | null
    activityType: string
    activitySummary: string
    actorType: "system" | "admin" | "customer"
    actorId: string | null
    metadata?: Record<string, unknown>
  },
) {
  const { error } = await admin.from("blitzpay_collection_activity_log").insert({
    organization_id: input.organizationId,
    invoice_id: input.invoiceId,
    customer_id: input.customerId,
    activity_type: input.activityType,
    activity_summary: input.activitySummary,
    actor_type: input.actorType,
    actor_id: input.actorId,
    metadata: input.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

export async function fetchBlitzpayPhase3bCollectionReporting(admin: SupabaseClient, organizationId: string) {
  assertUuid(organizationId, "organizationId")
  const { data: states, error: sErr } = await admin
    .from("blitzpay_invoice_collection_states")
    .select("collection_status, failed_attempt_count")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_PHASE_3B_REPORTING_SCAN_CAP)
  if (sErr) throw new Error(sErr.message)
  const { data: flows, error: fErr } = await admin
    .from("blitzpay_collection_recovery_flows")
    .select("flow_status, resolved_at, created_at")
    .eq("organization_id", organizationId)
    .limit(BLITZPAY_PHASE_3B_REPORTING_SCAN_CAP)
  if (fErr) throw new Error(fErr.message)
  return phase3bReportingMetrics({
    collectionStates: (states ?? []) as Array<{ collection_status: string; failed_attempt_count: number }>,
    recoveryFlows: (flows ?? []) as Array<{ flow_status: string; resolved_at: string | null; created_at: string }>,
  })
}

/** Read local PI mirror only — no Stripe HTTP; updates collection state counters/categories. */
export async function syncCollectionMetadataFromPaymentIntents(
  admin: SupabaseClient,
  organizationId: string,
  invoiceId: string,
): Promise<{ synced: boolean }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(invoiceId, "invoiceId")
  const { data: pis, error } = await admin
    .from("blitzpay_payment_intents")
    .select("status, stripe_payment_intent_id, updated_at")
    .eq("organization_id", organizationId)
    .eq("org_invoice_id", invoiceId)
    .order("updated_at", { ascending: false })
    .limit(40)
  if (error) throw new Error(error.message)
  const rows = pis ?? []
  if (!rows.length) return { synced: false }

  let lastFail: { category: string; safe: string } | null = null
  let lastSuccessAt: string | null = null
  let failCount = 0
  let attemptCount = 0
  for (const r of rows as Array<{ status: string; updated_at?: string | null }>) {
    attemptCount++
    const st = String(r.status || "").toLowerCase()
    if (st === "succeeded") {
      lastSuccessAt = r.updated_at ?? null
    } else if (
      st === "requires_payment_method" ||
      st === "canceled" ||
      st === "payment_failed" ||
      st.includes("fail")
    ) {
      failCount++
      const cat = categorizePaymentFailure(st)
      lastFail = { category: cat.category, safe: cat.safeReason }
    }
  }

  const { data: stateRow, error: stErr } = await admin
    .from("blitzpay_invoice_collection_states")
    .select("id, failed_attempt_count, first_failure_at")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)
    .maybeSingle()
  if (stErr) throw new Error(stErr.message)
  if (!stateRow) return { synced: false }

  const patch: Record<string, unknown> = {
    payment_attempt_count: Math.min(attemptCount, MAX_PAYMENT_ATTEMPT_COUNT),
    failed_attempt_count: Math.min(failCount, MAX_PAYMENT_ATTEMPT_COUNT),
    last_attempted_at: new Date().toISOString(),
  }
  if (lastSuccessAt) patch.last_successful_payment_at = lastSuccessAt
  if (lastFail) {
    patch.last_failure_category = lastFail.category
    patch.last_failure_reason = lastFail.safe
    if (!(stateRow as { first_failure_at?: string | null }).first_failure_at && failCount > 0) {
      patch.first_failure_at = new Date().toISOString()
    }
  }
  const { error: uErr } = await admin
    .from("blitzpay_invoice_collection_states")
    .update(patch)
    .eq("id", (stateRow as { id: string }).id)
  if (uErr) throw new Error(uErr.message)
  return { synced: true }
}

export async function ensureCollectionStateForInvoice(
  admin: SupabaseClient,
  input: { organizationId: string; invoiceId: string; customerId: string; billingProfileId?: string | null },
): Promise<{ id: string; created: boolean }> {
  assertUuid(input.organizationId, "organizationId")
  assertUuid(input.invoiceId, "invoiceId")
  assertUuid(input.customerId, "customerId")
  const { data: existing, error: e0 } = await admin
    .from("blitzpay_invoice_collection_states")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("invoice_id", input.invoiceId)
    .maybeSingle()
  if (e0) throw new Error(e0.message)
  if (existing) return { id: (existing as { id: string }).id, created: false }

  const now = new Date().toISOString()
  const { data: ins, error } = await admin
    .from("blitzpay_invoice_collection_states")
    .insert({
      organization_id: input.organizationId,
      invoice_id: input.invoiceId,
      customer_id: input.customerId,
      billing_profile_id: input.billingProfileId ?? null,
      collection_status: "current",
      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single()
  if (error) throw new Error(error.message)
  await appendActivity(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    activityType: "retry_scheduled",
    activitySummary: "Internal collection timeline was activated for this invoice. No message was sent automatically.",
    actorType: "system",
    actorId: null,
    metadata: { kind: "ensure_state" },
  })
  const { data: rf } = await admin
    .from("blitzpay_collection_recovery_flows")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("invoice_id", input.invoiceId)
    .maybeSingle()
  if (!rf) {
    const { error: rfErr } = await admin.from("blitzpay_collection_recovery_flows").insert({
      organization_id: input.organizationId,
      customer_id: input.customerId,
      invoice_id: input.invoiceId,
      flow_status: "active",
      trigger_type: "manual_review",
      current_stage: 0,
      max_stage: 5,
      created_at: now,
      updated_at: now,
    })
    if (rfErr) throw new Error(rfErr.message)
  }
  return { id: (ins as { id: string }).id, created: true }
}

export async function listCollectionStatesSafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { invoiceId?: string | null },
): Promise<SafeCollectionStateRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_invoice_collection_states")
    .select(
      "id, invoice_id, customer_id, collection_status, payment_attempt_count, failed_attempt_count, next_retry_at, last_attempted_at, last_successful_payment_at, last_failure_category, escalation_level, recovery_paused, autopay_enabled, first_failure_at",
    )
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(BLITZPAY_COLLECTION_STATE_LIST_CAP)
  if (options?.invoiceId) {
    assertUuid(options.invoiceId, "invoiceId")
    q = q.eq("invoice_id", options.invoiceId)
  }
  const { data: states, error } = await q
  if (error) throw new Error(error.message)
  const ids = (states ?? []).map((s) => (s as { invoice_id: string }).invoice_id)
  if (!ids.length) return []

  const { data: invs, error: iErr } = await admin
    .from("org_invoices")
    .select("id, invoice_number, title, amount_cents, status, due_date, paid_at")
    .eq("organization_id", organizationId)
    .in("id", ids.slice(0, BLITZPAY_COLLECTION_STATE_LIST_CAP))
  if (iErr) throw new Error(iErr.message)
  const invMap = new Map(
    (invs ?? []).map((r) => {
      const row = r as {
        id: string
        invoice_number: string
        title: string
        amount_cents: number
        status: string
        due_date: string | null
        paid_at: string | null
      }
      return [row.id, row]
    }),
  )

  const t = todayIsoDate()
  return (states ?? []).map((raw) => {
    const s = raw as {
      id: string
      invoice_id: string
      customer_id: string
      collection_status: string
      payment_attempt_count: number
      failed_attempt_count: number
      next_retry_at: string | null
      last_attempted_at: string | null
      last_successful_payment_at: string | null
      last_failure_category: string | null
      escalation_level: number
      recovery_paused: boolean
      autopay_enabled: boolean
      first_failure_at: string | null
    }
    const inv = invMap.get(s.invoice_id)
    const amount = inv ? Math.round(Number(inv.amount_cents)) : 0
    const derived = deriveCollectionStatusFromInvoice({
      invoiceStatus: inv?.status ?? "sent",
      paidAt: inv?.paid_at ?? null,
      dueDate: inv?.due_date ?? null,
      todayIsoDate: t,
      partialPaidCents: 0,
      invoiceAmountCents: amount,
      recoveryPaused: s.recovery_paused,
      failedAttemptCount: s.failed_attempt_count,
      nextRetryAt: s.next_retry_at,
    })
    const status = (s.collection_status as CollectionStateStatus) || derived
    return {
      id: s.id,
      invoiceId: s.invoice_id,
      customerId: s.customer_id,
      invoiceNumber: inv?.invoice_number ?? null,
      invoiceTitle: inv?.title ?? null,
      amountCents: amount,
      invoiceStatus: inv?.status ?? "unknown",
      dueDate: inv?.due_date ?? null,
      collectionStatus: status,
      statusLabel: humanCollectionStatusLabel(status),
      paymentAttemptCount: s.payment_attempt_count,
      failedAttemptCount: s.failed_attempt_count,
      nextRetryAt: s.next_retry_at,
      lastAttemptedAt: s.last_attempted_at,
      lastSuccessfulPaymentAt: s.last_successful_payment_at,
      lastFailureCategory: s.last_failure_category,
      escalationLevel: s.escalation_level,
      recoveryPaused: s.recovery_paused,
      autopayEnabled: s.autopay_enabled,
      recoveryReadiness: computeRecoveryReadiness({
        collectionStatus: status,
        escalationLevel: s.escalation_level,
        recoveryPaused: s.recovery_paused,
      }),
      derivedStatus: derived,
      firstFailureAt: s.first_failure_at ?? null,
    }
  })
}

export async function listCollectionAttemptsSafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { invoiceId?: string | null },
): Promise<SafeCollectionAttemptRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_collection_attempts")
    .select(
      "id, invoice_id, attempt_type, attempt_status, amount_cents, currency, failure_category, attempted_at, retry_eligible",
    )
    .eq("organization_id", organizationId)
    .order("attempted_at", { ascending: false })
    .limit(BLITZPAY_COLLECTION_ATTEMPT_LIST_CAP)
  if (options?.invoiceId) {
    assertUuid(options.invoiceId, "invoiceId")
    q = q.eq("invoice_id", options.invoiceId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      invoice_id: string
      attempt_type: string
      attempt_status: string
      amount_cents: number
      currency: string
      failure_category: string | null
      attempted_at: string
      retry_eligible: boolean
    }
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      attemptType: row.attempt_type,
      attemptStatus: row.attempt_status,
      amountCents: Math.round(Number(row.amount_cents)),
      currency: row.currency,
      failureCategory: row.failure_category,
      attemptedAt: row.attempted_at,
      retryEligible: row.retry_eligible,
    }
  })
}

export async function listRecoveryFlowsSafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { invoiceId?: string | null },
): Promise<SafeRecoveryFlowRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_collection_recovery_flows")
    .select("id, invoice_id, flow_status, trigger_type, next_action_at, last_action_at")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false })
    .limit(BLITZPAY_COLLECTION_FLOW_LIST_CAP)
  if (options?.invoiceId) {
    assertUuid(options.invoiceId, "invoiceId")
    q = q.eq("invoice_id", options.invoiceId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      invoice_id: string | null
      flow_status: string
      trigger_type: string
      next_action_at: string | null
      last_action_at: string | null
    }
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      flowStatus: row.flow_status,
      triggerType: row.trigger_type,
      nextActionAt: row.next_action_at,
      lastActionAt: row.last_action_at,
    }
  })
}

export async function listCollectionActivitySafe(
  admin: SupabaseClient,
  organizationId: string,
  options?: { invoiceId?: string | null },
): Promise<SafeActivityRow[]> {
  assertUuid(organizationId, "organizationId")
  let q = admin
    .from("blitzpay_collection_activity_log")
    .select("id, invoice_id, activity_type, activity_summary, actor_type, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(BLITZPAY_COLLECTION_ACTIVITY_LIST_CAP)
  if (options?.invoiceId) {
    assertUuid(options.invoiceId, "invoiceId")
    q = q.eq("invoice_id", options.invoiceId)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => {
    const row = r as {
      id: string
      invoice_id: string | null
      activity_type: string
      activity_summary: string
      actor_type: string
      created_at: string
    }
    return {
      id: row.id,
      invoiceId: row.invoice_id,
      activityType: row.activity_type,
      activitySummary: row.activity_summary,
      actorType: row.actor_type,
      createdAt: row.created_at,
    }
  })
}

export async function getCollectionsSummary(admin: SupabaseClient, organizationId: string) {
  const states = await listCollectionStatesSafe(admin, organizationId)
  if (!states.length) {
    return {
      healthScore: 100,
      healthBand: computeCollectionHealthBand(100),
      retryQueueCount: 0,
      escalatedCount: 0,
      failedIndicatorCount: 0,
      delinquencyTrendUp: false,
      sampleCap: BLITZPAY_COLLECTION_STATE_LIST_CAP,
    }
  }
  const problem = states.filter((s) =>
    ["failed", "escalated", "retry_scheduled", "retry_in_progress"].includes(s.collectionStatus),
  ).length
  const resolved = states.filter((s) => s.collectionStatus === "resolved").length
  const score = computeCollectionHealthScore0to100({
    resolvedCount: resolved,
    activeProblemCount: problem,
    totalSample: states.length || 1,
  })
  return {
    healthScore: score,
    healthBand: computeCollectionHealthBand(score),
    retryQueueCount: states.filter((s) => s.collectionStatus === "retry_scheduled").length,
    escalatedCount: states.filter((s) => s.collectionStatus === "escalated").length,
    failedIndicatorCount: states.filter((s) => s.collectionStatus === "failed").length,
    delinquencyTrendUp: problem > resolved && states.length > 3,
    sampleCap: BLITZPAY_COLLECTION_STATE_LIST_CAP,
  }
}

async function loadState(admin: SupabaseClient, organizationId: string, invoiceId: string) {
  const { data, error } = await admin
    .from("blitzpay_invoice_collection_states")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("invoice_id", invoiceId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown> | null
}

export async function staffScheduleRetry(
  admin: SupabaseClient,
  input: { organizationId: string; invoiceId: string; customerId: string; userId: string },
) {
  await ensureCollectionStateForInvoice(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
  })
  let state = await loadState(admin, input.organizationId, input.invoiceId)
  if (!state) throw new Error("state_missing")
  const { count: scheduledCount, error: cErr } = await admin
    .from("blitzpay_collection_attempts")
    .select("id", { count: "exact", head: true })
    .eq("collection_state_id", state.id as string)
    .eq("attempt_type", "scheduled_retry")
  if (cErr) throw new Error(cErr.message)
  if ((scheduledCount ?? 0) >= MAX_DETERMINISTIC_RETRY_SLOTS) {
    const err = new Error("retry_not_eligible:schedule_cap")
    ;(err as Error & { code?: string }).code = "schedule_cap"
    throw err
  }
  const st = state.collection_status as CollectionStateStatus
  const elig = computeRetryEligibility({
    recoveryPaused: Boolean(state.recovery_paused),
    collectionStatus: st,
    failedAttemptCount: Math.round(Number(state.failed_attempt_count)),
    paymentAttemptCount: Math.round(Number(state.payment_attempt_count)),
  })
  if (!elig.eligible) {
    const err = new Error(`retry_not_eligible:${elig.reason}`)
    ;(err as Error & { code?: string }).code = elig.reason
    throw err
  }

  let firstFailure = (state.first_failure_at as string | null) ?? null
  if (!firstFailure) {
    firstFailure = new Date().toISOString()
  }
  const failedCount = Math.round(Number(state.failed_attempt_count))
  const wave = Math.min(scheduledCount ?? 0, MAX_DETERMINISTIC_RETRY_SLOTS - 1)
  const next = computeNextRetryAtFromFirstFailure(firstFailure, wave)
  const esc = computeEscalationLevel(failedCount)

  const { data: inv, error: invErr } = await admin
    .from("org_invoices")
    .select("amount_cents")
    .eq("organization_id", input.organizationId)
    .eq("id", input.invoiceId)
    .maybeSingle()
  if (invErr) throw new Error(invErr.message)
  const amt = inv ? Math.round(Number((inv as { amount_cents: number }).amount_cents)) : 0

  const { error: aErr } = await admin.from("blitzpay_collection_attempts").insert({
    organization_id: input.organizationId,
    invoice_id: input.invoiceId,
    customer_id: input.customerId,
    collection_state_id: state.id as string,
    attempt_type: "scheduled_retry",
    attempt_status: "skipped",
    amount_cents: 0,
    currency: "usd",
    retry_eligible: false,
    initiated_by: input.userId,
    metadata: { phase: "3b", note: "Scheduled follow-up window; no charge in this phase.", next_retry_at: next },
    attempted_at: new Date().toISOString(),
  })
  if (aErr) throw new Error(aErr.message)

  const { error: uErr } = await admin
    .from("blitzpay_invoice_collection_states")
    .update({
      next_retry_at: next,
      escalation_level: esc,
      collection_status: next ? "retry_scheduled" : "escalated",
      last_attempted_at: new Date().toISOString(),
      first_failure_at: firstFailure,
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id as string)
  if (uErr) throw new Error(uErr.message)

  await appendActivity(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    activityType: "retry_scheduled",
    activitySummary: "A courteous follow-up window was scheduled. No automatic charge runs in this release.",
    actorType: "admin",
    actorId: input.userId,
  })
}

export async function staffPauseRecovery(
  admin: SupabaseClient,
  input: { organizationId: string; invoiceId: string; customerId: string; userId: string },
) {
  const state = await loadState(admin, input.organizationId, input.invoiceId)
  if (!state) throw new Error("not_found")
  const { error } = await admin
    .from("blitzpay_invoice_collection_states")
    .update({ recovery_paused: true, updated_at: new Date().toISOString() })
    .eq("id", state.id as string)
  if (error) throw new Error(error.message)
  await admin
    .from("blitzpay_collection_recovery_flows")
    .update({ flow_status: "paused", updated_at: new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .eq("invoice_id", input.invoiceId)
  await appendActivity(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    activityType: "flow_paused",
    activitySummary: "Follow-up automation was paused for this invoice.",
    actorType: "admin",
    actorId: input.userId,
  })
}

export async function staffResumeRecovery(
  admin: SupabaseClient,
  input: { organizationId: string; invoiceId: string; customerId: string; userId: string },
) {
  const state = await loadState(admin, input.organizationId, input.invoiceId)
  if (!state) throw new Error("not_found")
  const { error } = await admin
    .from("blitzpay_invoice_collection_states")
    .update({ recovery_paused: false, updated_at: new Date().toISOString() })
    .eq("id", state.id as string)
  if (error) throw new Error(error.message)
  await admin
    .from("blitzpay_collection_recovery_flows")
    .update({ flow_status: "active", updated_at: new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .eq("invoice_id", input.invoiceId)
    .eq("flow_status", "paused")
  await appendActivity(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    activityType: "flow_resumed",
    activitySummary: "Follow-up automation was resumed for this invoice.",
    actorType: "admin",
    actorId: input.userId,
  })
}

export async function staffResolveCollection(
  admin: SupabaseClient,
  input: { organizationId: string; invoiceId: string; customerId: string; userId: string },
) {
  const state = await loadState(admin, input.organizationId, input.invoiceId)
  if (!state) throw new Error("not_found")
  const { error } = await admin
    .from("blitzpay_invoice_collection_states")
    .update({
      collection_status: "resolved",
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id as string)
  if (error) throw new Error(error.message)
  await appendActivity(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    activityType: "manual_resolution",
    activitySummary: "This balance was marked settled from a staff review.",
    actorType: "admin",
    actorId: input.userId,
  })
}

export async function staffMarkUncollectible(
  admin: SupabaseClient,
  input: { organizationId: string; invoiceId: string; customerId: string; userId: string },
) {
  const state = await loadState(admin, input.organizationId, input.invoiceId)
  if (!state) throw new Error("not_found")
  const { error } = await admin
    .from("blitzpay_invoice_collection_states")
    .update({
      collection_status: "uncollectible",
      next_retry_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", state.id as string)
  if (error) throw new Error(error.message)
  await appendActivity(admin, {
    organizationId: input.organizationId,
    invoiceId: input.invoiceId,
    customerId: input.customerId,
    activityType: "marked_uncollectible",
    activitySummary: "This invoice was closed as not collectible after review.",
    actorType: "admin",
    actorId: input.userId,
  })
}

export { logBlitzpayServerFailure }

/** Hash latest PI id for attempt row when recording settlement sync (optional). */
export function hashPaymentIntentForAttempt(stripePaymentIntentId: string | null): string | null {
  if (!stripePaymentIntentId?.trim()) return null
  return hashStripeReference(stripePaymentIntentId.trim())
}
