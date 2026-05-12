import "server-only"

import type { SupabaseClient } from "@supabase/supabase-js"
import { assertUuid } from "@/lib/blitzpay/idempotency-keys"
import { hashBlitzpayMobileAudit } from "@/lib/blitzpay/blitzpay-mobile-audit"
import { detectMobileIntentSyncConflict, orderMobileIntentIdsForSync } from "@/lib/blitzpay/blitzpay-mobile-sync"
import type { BlitzpayOrgReportingSnapshot } from "@/lib/blitzpay/blitzpay-reporting-snapshot"
import { normalizeOrgMemberRole } from "@/lib/permissions/model"

export const BLITZPAY_MOBILE_INTENT_LIST_CAP = 40
export const BLITZPAY_MOBILE_SIGNATURE_LIST_CAP = 36
export const BLITZPAY_MOBILE_PAYROLL_LIST_CAP = 32
export const BLITZPAY_MOBILE_TREASURY_LIST_CAP = 24
export const BLITZPAY_MOBILE_SYNC_BATCH_CAP = 24
export const BLITZPAY_MOBILE_AUDIT_LIST_CAP = 40

const SENSITIVE_METADATA_KEYS = /^(stripe_|pm_|pi_|cus_|payment_method|card_|bank_)/i

export type BlitzpayPhase6aReportingExtension = {
  mobileFinancialIntentCount: number
  offlineFinancialIntentCount: number
  mobileSyncFailureRate: number
  mobileSignatureCoverageRate: number
  mobilePayrollApprovalPendingCount: number
  fieldCollectionsIntentCents: number
  mobileTreasuryVisibilityScore: number
  mobileConflictReviewCount: number
}

export function zeroPhase6aReportingExtension(): BlitzpayPhase6aReportingExtension {
  return {
    mobileFinancialIntentCount: 0,
    offlineFinancialIntentCount: 0,
    mobileSyncFailureRate: 0,
    mobileSignatureCoverageRate: 0,
    mobilePayrollApprovalPendingCount: 0,
    fieldCollectionsIntentCents: 0,
    mobileTreasuryVisibilityScore: 0,
    mobileConflictReviewCount: 0,
  }
}

function clampInt(n: number, lo: number, hi: number): number {
  const x = Math.round(Number(n))
  if (!Number.isFinite(x)) return lo
  return Math.min(hi, Math.max(lo, x))
}

/** Strip provider-ish keys from metadata for API responses (bounded shallow copy). */
export function sanitizeMobileMetadataForResponse(metadata: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const m = metadata && typeof metadata === "object" ? { ...metadata } : {}
  for (const k of Object.keys(m)) {
    if (SENSITIVE_METADATA_KEYS.test(k)) delete m[k]
  }
  return m
}

export function filterMobileIntentsForTechnician<T extends { technician_id?: string | null }>(
  rows: ReadonlyArray<T>,
  technicianUserId: string,
): T[] {
  assertUuid(technicianUserId, "technicianUserId")
  return rows.filter((r) => String(r.technician_id ?? "") === technicianUserId)
}

export function validateMobileIntentCreate(input: {
  intent_type: string
  intent_status?: string
  amount_cents?: number | null
  summary?: string | null
}): { ok: true } | { ok: false; message: string } {
  const allowedTypes = new Set([
    "payment_collection",
    "customer_signature",
    "financing_request",
    "claim_intake",
    "payroll_review",
    "treasury_note",
    "protection_plan_offer",
    "custom",
  ])
  if (!allowedTypes.has(input.intent_type)) return { ok: false, message: "invalid_intent_type" }
  const st = input.intent_status ?? "draft"
  const allowedStatus = new Set(["draft", "queued", "synced", "reviewed", "approved", "rejected", "archived"])
  if (!allowedStatus.has(st)) return { ok: false, message: "invalid_intent_status" }
  if (input.amount_cents != null) {
    const a = Math.round(Number(input.amount_cents))
    if (!Number.isFinite(a) || a < 0 || a > 500_000_000) return { ok: false, message: "invalid_amount" }
  }
  if (input.summary != null && String(input.summary).length > 2000) return { ok: false, message: "summary_too_long" }
  return { ok: true }
}

export async function insertBlitzpayMobileAuditLog(
  admin: SupabaseClient,
  row: {
    organization_id: string
    sync_batch_id?: string | null
    mobile_intent_id?: string | null
    audit_type:
      | "intent_captured"
      | "intent_synced"
      | "signature_captured"
      | "payroll_item_reviewed"
      | "treasury_snapshot_viewed"
      | "sync_batch_processed"
      | "conflict_detected"
      | "manual_override"
    actor_type: "system" | "admin" | "user" | "technician"
    actor_id?: string | null
    audit_summary: string
    metadata?: Record<string, unknown>
  },
): Promise<void> {
  const hash = hashBlitzpayMobileAudit({
    audit_type: row.audit_type,
    organization_id: row.organization_id,
    sync_batch_id: row.sync_batch_id ?? null,
    mobile_intent_id: row.mobile_intent_id ?? null,
    audit_summary: row.audit_summary,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    metadata: row.metadata ?? {},
  })
  const { error } = await admin.from("blitzpay_mobile_audit_log").insert({
    organization_id: row.organization_id,
    sync_batch_id: row.sync_batch_id ?? null,
    mobile_intent_id: row.mobile_intent_id ?? null,
    audit_type: row.audit_type,
    actor_type: row.actor_type,
    actor_id: row.actor_id ?? null,
    audit_summary: row.audit_summary,
    immutable_hash: hash,
    metadata: row.metadata ?? {},
  })
  if (error) throw new Error(error.message)
}

/** Field-safe treasury snapshot row for mobile clients (integer cents + bounded score). */
export function sanitizeMobileTreasurySnapshotForFieldRole(row: {
  available_cash_cents: number | null
  upcoming_payables_cents: number | null
  upcoming_payroll_cents: number | null
  collections_due_cents: number | null
  treasury_health_score: number | null
  snapshot_date: string
  visible_to_role: string
}): Record<string, unknown> {
  return {
    snapshot_date: row.snapshot_date,
    visible_to_role: row.visible_to_role,
    available_cash_cents: row.available_cash_cents == null ? null : Math.max(0, Math.round(Number(row.available_cash_cents))),
    upcoming_payables_cents: row.upcoming_payables_cents == null ? null : Math.max(0, Math.round(Number(row.upcoming_payables_cents))),
    upcoming_payroll_cents: row.upcoming_payroll_cents == null ? null : Math.max(0, Math.round(Number(row.upcoming_payroll_cents))),
    collections_due_cents: row.collections_due_cents == null ? null : Math.max(0, Math.round(Number(row.collections_due_cents))),
    treasury_health_score:
      row.treasury_health_score == null ? null : clampInt(Number(row.treasury_health_score), 0, 100),
  }
}

export async function buildPhase6aMobileReportingSlice(
  admin: SupabaseClient,
  organizationId: string,
  snapshot: Pick<BlitzpayOrgReportingSnapshot, "treasuryFailedPayoutCount30d" | "estimatedOperatingCashCents">,
): Promise<BlitzpayPhase6aReportingExtension> {
  assertUuid(organizationId, "organizationId")
  try {
    const { data: intents, error: iErr } = await admin
      .from("blitzpay_mobile_financial_intents")
      .select("id, intent_status, intent_type, captured_offline, amount_cents")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_MOBILE_INTENT_LIST_CAP)
    if (iErr) throw new Error(iErr.message)
    const intentRows = (intents ?? []) as Array<{
      id: string
      intent_status: string
      intent_type: string
      captured_offline: boolean
      amount_cents: number | null
    }>
    const mobileFinancialIntentCount = intentRows.length
    let offlineFinancialIntentCount = 0
    let fieldCollectionsIntentCents = 0
    for (const r of intentRows) {
      if (r.captured_offline) offlineFinancialIntentCount += 1
      const st = String(r.intent_status)
      if (String(r.intent_type) === "payment_collection" && (st === "draft" || st === "queued")) {
        fieldCollectionsIntentCents += Math.max(0, Math.round(Number(r.amount_cents ?? 0)))
      }
    }
    fieldCollectionsIntentCents = Math.min(500_000_000, fieldCollectionsIntentCents)

    const { data: sigs, error: sErr } = await admin
      .from("blitzpay_mobile_signature_authorizations")
      .select("id, authorization_status")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_MOBILE_SIGNATURE_LIST_CAP)
    if (sErr) throw new Error(sErr.message)
    const sigRows = (sigs ?? []) as Array<{ id: string; authorization_status: string }>
    const syncedSig = sigRows.filter((s) => String(s.authorization_status) === "synced" || String(s.authorization_status) === "verified").length
    const mobileSignatureCoverageRate =
      intentRows.length === 0 ? 0 : clampInt(Math.round((syncedSig * 100) / Math.max(1, intentRows.length)), 0, 100)

    const { data: batches, error: bErr } = await admin
      .from("blitzpay_mobile_sync_batches")
      .select("id, batch_status")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_MOBILE_SYNC_BATCH_CAP)
    if (bErr) throw new Error(bErr.message)
    const batchRows = (batches ?? []) as Array<{ batch_status: string }>
    const totalBatches = batchRows.length
    let badBatches = 0
    for (const b of batchRows) {
      const st = String(b.batch_status)
      if (st === "failed" || st === "partially_failed") badBatches += 1
    }
    const mobileSyncFailureRate = totalBatches === 0 ? 0 : clampInt(Math.round((badBatches * 100) / totalBatches), 0, 100)

    const { data: payroll, error: pErr } = await admin
      .from("blitzpay_mobile_payroll_approval_items")
      .select("id, approval_status")
      .eq("organization_id", organizationId)
      .order("id", { ascending: true })
      .limit(BLITZPAY_MOBILE_PAYROLL_LIST_CAP)
    if (pErr) throw new Error(pErr.message)
    const mobilePayrollApprovalPendingCount = (payroll ?? []).filter(
      (r) => String((r as { approval_status: string }).approval_status) === "pending",
    ).length

    const { data: treas, error: tErr } = await admin
      .from("blitzpay_mobile_treasury_snapshots")
      .select("treasury_health_score, visible_to_role")
      .eq("organization_id", organizationId)
      .order("snapshot_date", { ascending: false })
      .limit(BLITZPAY_MOBILE_TREASURY_LIST_CAP)
    if (tErr) throw new Error(tErr.message)
    let mobileTreasuryVisibilityScore = 0
    const scores = (treas ?? [])
      .map((r) => (r as { treasury_health_score: number | null }).treasury_health_score)
      .filter((x): x is number => x != null)
      .map((x) => clampInt(Number(x), 0, 100))
    if (scores.length > 0) mobileTreasuryVisibilityScore = clampInt(Math.round(scores.reduce((a, b) => a + b, 0) / scores.length), 0, 100)
    else {
      const cashHint = snapshot.estimatedOperatingCashCents > 0 ? 70 : 40
      const failHint = snapshot.treasuryFailedPayoutCount30d > 0 ? 30 : 0
      mobileTreasuryVisibilityScore = clampInt(cashHint - failHint, 0, 100)
    }

    const { data: conflicts, error: cErr } = await admin
      .from("blitzpay_mobile_audit_log")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("audit_type", "conflict_detected")
      .order("id", { ascending: true })
      .limit(BLITZPAY_MOBILE_AUDIT_LIST_CAP)
    if (cErr) throw new Error(cErr.message)
    const mobileConflictReviewCount = Math.min(10_000, (conflicts ?? []).length)

    return {
      mobileFinancialIntentCount,
      offlineFinancialIntentCount,
      mobileSyncFailureRate,
      mobileSignatureCoverageRate,
      mobilePayrollApprovalPendingCount,
      fieldCollectionsIntentCents,
      mobileTreasuryVisibilityScore,
      mobileConflictReviewCount,
    }
  } catch {
    return zeroPhase6aReportingExtension()
  }
}

export { detectMobileIntentSyncConflict, orderMobileIntentIdsForSync }

export async function processMobileSyncIntents(
  admin: SupabaseClient,
  organizationId: string,
  input: {
    intentIds: string[]
    clientUpdatedAtByIntentId?: Record<string, string | null> | null
    userId: string
    deviceReferenceHash?: string | null
  },
): Promise<{ batchId: string; syncedIds: string[]; conflictIds: string[] }> {
  assertUuid(organizationId, "organizationId")
  assertUuid(input.userId, "userId")
  const ordered = orderMobileIntentIdsForSync(input.intentIds).slice(0, BLITZPAY_MOBILE_INTENT_LIST_CAP)
  const { data: batchRow, error: bIns } = await admin
    .from("blitzpay_mobile_sync_batches")
    .insert({
      organization_id: organizationId,
      user_id: input.userId,
      batch_status: "processing",
      device_reference_hash: input.deviceReferenceHash?.trim().slice(0, 128) ?? null,
      offline_item_count: ordered.length,
      processed_item_count: 0,
      failed_item_count: 0,
      metadata: {},
    })
    .select("id")
    .single()
  if (bIns) throw new Error(bIns.message)
  const batchId = (batchRow as { id: string }).id

  const syncedIds: string[] = []
  const conflictIds: string[] = []
  const clientMap = input.clientUpdatedAtByIntentId ?? {}

  for (const intentId of ordered) {
    const { data: row, error: gErr } = await admin
      .from("blitzpay_mobile_financial_intents")
      .select("id, updated_at, intent_status")
      .eq("organization_id", organizationId)
      .eq("id", intentId)
      .maybeSingle()
    if (gErr || !row) {
      conflictIds.push(intentId)
      continue
    }
    const serverUpdated = String((row as { updated_at: string }).updated_at)
    const clientKnown = clientMap[intentId] ?? null
    if (detectMobileIntentSyncConflict(serverUpdated, clientKnown)) {
      conflictIds.push(intentId)
      await insertBlitzpayMobileAuditLog(admin, {
        organization_id: organizationId,
        sync_batch_id: batchId,
        mobile_intent_id: intentId,
        audit_type: "conflict_detected",
        actor_type: "system",
        actor_id: null,
        audit_summary: `Sync conflict for intent ${intentId}`,
        metadata: { intent_id: intentId },
      })
      continue
    }
    const { error: uErr } = await admin
      .from("blitzpay_mobile_financial_intents")
      .update({
        intent_status: "synced",
        synced_at: new Date().toISOString(),
        captured_offline: false,
      })
      .eq("organization_id", organizationId)
      .eq("id", intentId)
    if (uErr) {
      conflictIds.push(intentId)
      continue
    }
    syncedIds.push(intentId)
    await insertBlitzpayMobileAuditLog(admin, {
      organization_id: organizationId,
      sync_batch_id: batchId,
      mobile_intent_id: intentId,
      audit_type: "intent_synced",
      actor_type: "user",
      actor_id: input.userId,
      audit_summary: `Intent synced (${intentId})`,
      metadata: { intent_id: intentId },
    })
  }

  const failed = conflictIds.length
  const processed = syncedIds.length
  await admin
    .from("blitzpay_mobile_sync_batches")
    .update({
      batch_status: failed === 0 ? "completed" : processed === 0 ? "failed" : "partially_failed",
      processed_item_count: processed,
      failed_item_count: failed,
      completed_at: new Date().toISOString(),
    })
    .eq("id", batchId)

  await insertBlitzpayMobileAuditLog(admin, {
    organization_id: organizationId,
    sync_batch_id: batchId,
    audit_type: "sync_batch_processed",
    actor_type: "system",
    actor_id: null,
    audit_summary: `Sync batch ${batchId} processed`,
    metadata: { processed, failed },
  })

  return { batchId, syncedIds, conflictIds }
}

export function isBlitzpayMobileFinancePrivilegedRole(rawOrgMemberRole: string | null | undefined): boolean {
  const r = normalizeOrgMemberRole(rawOrgMemberRole)
  return r === "owner" || r === "admin" || r === "manager"
}

/** Shallow metadata for DB insert — strips provider-ish keys and caps keys (bounded). */
export function sanitizeMobileMetadataForPersist(metadata: unknown): Record<string, unknown> {
  const m = metadata && typeof metadata === "object" && !Array.isArray(metadata) ? { ...(metadata as Record<string, unknown>) } : {}
  const keys = Object.keys(m).sort((a, b) => a.localeCompare(b)).slice(0, 48)
  const out: Record<string, unknown> = {}
  for (const k of keys) {
    if (SENSITIVE_METADATA_KEYS.test(k)) continue
    const v = m[k]
    if (v != null && typeof v === "object") continue
    out[k] = v
  }
  return out
}

export function formatMobileIntentRowForApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    technician_id: row.technician_id ?? null,
    customer_id: row.customer_id ?? null,
    work_order_id: row.work_order_id ?? null,
    invoice_id: row.invoice_id ?? null,
    intent_type: row.intent_type,
    intent_status: row.intent_status,
    captured_offline: Boolean(row.captured_offline),
    captured_at: row.captured_at,
    synced_at: row.synced_at ?? null,
    reviewed_at: row.reviewed_at ?? null,
    reviewed_by: row.reviewed_by ?? null,
    amount_cents: row.amount_cents == null ? null : Math.max(0, Math.round(Number(row.amount_cents))),
    currency: row.currency ?? "usd",
    summary: row.summary ?? null,
    metadata: sanitizeMobileMetadataForResponse(row.metadata as Record<string, unknown> | null | undefined),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/** List response: never expose raw signature hashes. */
export function formatMobileSignatureRowForList(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    mobile_intent_id: row.mobile_intent_id ?? null,
    customer_id: row.customer_id ?? null,
    work_order_id: row.work_order_id ?? null,
    invoice_id: row.invoice_id ?? null,
    authorization_type: row.authorization_type,
    authorization_status: row.authorization_status,
    signer_name: row.signer_name ?? null,
    signer_email: row.signer_email ?? null,
    signed_at: row.signed_at,
    signature_reference_recorded: true,
    metadata: sanitizeMobileMetadataForResponse(row.metadata as Record<string, unknown> | null | undefined),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export function formatMobilePayrollApprovalRowForApi(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    technician_id: row.technician_id ?? null,
    payroll_run_id: row.payroll_run_id ?? null,
    work_order_id: row.work_order_id ?? null,
    approval_status: row.approval_status,
    approval_type: row.approval_type,
    amount_cents: row.amount_cents == null ? null : Math.max(0, Math.round(Number(row.amount_cents))),
    submitted_at: row.submitted_at,
    approved_at: row.approved_at ?? null,
    approved_by: row.approved_by ?? null,
    dispute_reason: row.dispute_reason ?? null,
    metadata: sanitizeMobileMetadataForResponse(row.metadata as Record<string, unknown> | null | undefined),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}
